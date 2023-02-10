const net = require('net')
const fs = require('fs')
const FramedStream = require('framed-stream')

const zzz = new Int32Array(new SharedArrayBuffer(4))
const sleep = (ms) => Atomics.wait(zzz, 0, 0, ms)
const pipe = process.platform === 'win32' ? '\\\\.\\pipe\\server' : './server.sock'

const { socket, bootstrap } = connect(pipe)
const stream = new FramedStream(socket)

console.log('bootstrap:', bootstrap)

stream.on('data', function (data) {
  console.log('data:', data.toString())
})

function connect (pipe) {
  const socket = net.connect({ path: pipe })

  let offset = 0
  const fd = socket._handle.fd
  const buf = Buffer.allocUnsafe(128 * 1024)

  readSync(4)

  const len = buf[0] + (buf[1] << 8) + (buf[2] << 16) + (buf[3] << 24)

  readSync(len)

  const bootstrap = buf.subarray(4, 4 + len).toString()

  return { socket, bootstrap }

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
        throw err
      }
    }
  }
}
