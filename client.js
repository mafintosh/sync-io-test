const net = require('net')
const fs = require('fs')
const FramedStream = require('framed-stream')

const zzz = new Int32Array(new SharedArrayBuffer(4))
const sleep = (ms) => Atomics.wait(zzz, 0, 0, ms)
const pipe = process.platform === 'win32' ? '\\\\.\\pipe\\server' : './server.sock'

const { socket, bootstrap } = connect(pipe, 'test-ua')

console.log('bootstrap:', bootstrap)

// obvs the framed stream should come from the bootstrap code, just for testing
const stream = new FramedStream(socket)

stream.on('data', function (data) {
  console.log('data:', data.toString())
})

function connect (pipe, userAgent) {
  let time = 5
  let error = null

  for (let i = 0; i < 40; i++) { // ~8s
    try {
      return tryConnect(pipe, userAgent)
    } catch (err) {
      error = err
      time *= 2
      if (time > 250) time = 250
      sleep(time)
    }
  }

  throw error
}

function tryConnect (pipe, userAgent) {
  let socket = process.platform === 'win32' ? null : net.connect({ path: pipe })
  let offset = 0
  let buf = Buffer.allocUnsafe(128 * 1024)

  const fd = socket ? socket._handle.fd : fs.openSync(pipe, 'w+')

  const userAgentBuffer = Buffer.from(userAgent)
  const frameSize = 1 + userAgentBuffer.byteLength
  const frame = Buffer.allocUnsafe(4 + frameSize)

  frame[0] = frameSize
  frame[1] = frameSize >>> 8
  frame[2] = frameSize >>> 16
  frame[3] = frameSize >>> 24
  frame[4] = userAgentBuffer.byteLength
  frame.set(userAgentBuffer, 5)

  writeSync(frame)

  readSync(4)

  const len = buf[0] + (buf[1] << 8) + (buf[2] << 16) + (buf[3] << 24)

  if (buf.byteLength < len + 4) {
    buf = Buffer.allocUnsafe(len + 4)
    buf.fill(0, 0, 4) // just reset the initial len for extra safety
  }

  readSync(len)

  const bootstrap = readString(4)
  if (!socket) socket = new net.Socket({ fd })

  return { socket, bootstrap }

  function writeSync (buf) {
    let len = buf.byteLength
    let offset = 0

    while (len > 0) {
      try {
        const wrote = fs.writeSync(fd, buf, offset, len)
        len -= wrote
        offset += wrote
      } catch (err) {
        if (err.code === 'EAGAIN') {
          sleep(5)
          continue
        }

        closeSync()

        throw err
      }
    }
  }

  function readSync (len) {
    while (len > 0) {
      try {
        const read = fs.readSync(fd, buf, offset, len)
        len -= read
        offset += read
      } catch (err) {
        if (err.code === 'EAGAIN') {
          sleep(5)
          continue
        }

        closeSync()

        throw err
      }
    }
  }

  function closeSync () {
    if (socket) {
      socket.destroy()
      socket.on('error', noop)
    } else {
      try {
        fs.closeSync(fd)
      } catch {}
    }
  }

  function readString (offset) {
    const byte = buf[offset++]
    let len = byte

    if (byte === 0xfd) len = buf[offset++] + buf[offset++] * 0x100
    if (byte === 0xfe) len = buf[offset++] + buf[offset++] * 0x100 + buf[offset++] * 0x10000 + buf[offset++] * 0x1000000
    if (byte === 0xff) throw new Error('String length should be < 64bit')

    return buf.subarray(offset, offset += len).toString()
  }

  function noop () {}
}
