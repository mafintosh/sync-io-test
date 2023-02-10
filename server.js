const net = require('net')
const FramedSocket = require('framed-stream')

const server = net.createServer(function (socket) {
  const stream = new FramedSocket(socket)

  console.log('new socket, who dis')

  setTimeout(function () {
    stream.write('hello world')
    stream.write('another one!')
  }, 1000)
})

require('fs').unlink('server.sock', function () {
  server.listen('server.sock')
})
