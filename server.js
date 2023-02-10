const net = require('net')
const FramedSocket = require('framed-stream')
const c = require('compact-encoding')

const server = net.createServer(function (socket) {
  const stream = new FramedSocket(socket)

  console.log('new socket, who dis')

  stream.once('data', function (data) {
    console.log('client said', c.decode(c.string, data))

    setTimeout(function () {
      const buf = c.encode(c.string, 'the handshake code')

      stream.write(buf)
      stream.write('another one!')
    }, 1000)
  })
})

if (process.platform === 'win32') {
  server.listen('\\\\.\\pipe\\server')
} else {
  require('fs').unlink('server.sock', function () {
    server.listen('server.sock')
  })
}
