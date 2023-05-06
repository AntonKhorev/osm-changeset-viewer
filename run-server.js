import runClientServer from './tools/client-server.js'

const dstDir='dist'
let clientServer,clientUrl
console.log(`running client server`)
clientServer=await runClientServer(dstDir,5500)
clientUrl=clientServer.url
