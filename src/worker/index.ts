self.onconnect=ev=>{
	const port=ev.ports[0]
	port.onmessage=ev=>{
		if (ev.data.type=='getUserInfo') {
			console.log('received user info request',ev.data)
		}
	}
}
