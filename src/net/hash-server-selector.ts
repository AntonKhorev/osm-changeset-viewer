import type Connection from './connection'
import type Server from './server'
import type ServerList from './server-list'
import type ServerSelector from './server-selector'
import {getHashFromLocation, detachValueFromHash, attachValueToFrontOfHash} from '../util/hash'
import {code} from '../util/html-shortcuts'
import {escapeHash} from '../util/escape'

export default class HashServerSelector implements ServerSelector {
	readonly hostHashValue: string|null
	constructor(
		private serverList: ServerList
	) {
		const hash=getHashFromLocation()
		;[this.hostHashValue]=detachValueFromHash('host',hash)
	}

	// generic server selector methods
	selectServer(): Server|undefined {
		return this.getServerForHostHashValue(this.hostHashValue)
	}
	getServerSelectHref(server: Server): string {
		const baseLocation=location.pathname+location.search
		const hashValue=this.getHostHashValueForServer(server)
		return baseLocation+(hashValue ? `#host=`+escapeHash(hashValue) : '')
	}
	addServerSelectToAppInstallLocationHref(server: Server, installLocationHref: string): string {
		const hashValue=this.getHostHashValueForServer(server)
		return installLocationHref+(hashValue ? `#host=`+escapeHash(hashValue) : '')
	}
	makeServerSelectErrorMessage(): (string|HTMLElement)[] {
		const hostHash=(this.hostHashValue!=null
			? `host=`+escapeHash(this.hostHashValue)
			: ``
		)
		return [
			`Unknown server in URL hash parameter `,code(hostHash),`.`
		]
	}
	
	// host-hash-specific methods
	getHostHashValueForServer(server: Server): string|null {
		let hostHashValue:null|string = null
		if (server!=this.serverList.defaultServer) {
			hostHashValue=server.host
		}
		return hostHashValue
	}
	getServerForHostHashValue(hostHashValue: string|null): Server|undefined {
		if (hostHashValue==null) return this.serverList.defaultServer
		return this.serverList.servers.get(hostHashValue)
	}
	installHashChangeListener(
		cx: Connection|undefined,
		callback: (hostlessHash:string)=>void,
		callBackImmediately=false
	): void {
		window.addEventListener('hashchange',()=>{
			const hash=getHashFromLocation()
			const [hostHashValue,hostlessHash]=detachValueFromHash('host',hash)
			if (!cx) {
				if (hostHashValue!=this.hostHashValue) location.reload()
				return
			}
			if (hostHashValue!=this.getHostHashValueForServer(cx.server)) {
				location.reload()
				return
			}
			callback(hostlessHash)
		})
		if (callBackImmediately) {
			const hash=getHashFromLocation()
			const [,hostlessHash]=detachValueFromHash('host',hash)
			callback(hostlessHash)
		}
	}
	getHostlessHash(): string {
		const hash=getHashFromLocation()
		const [,hostlessHash]=detachValueFromHash('host',hash)
		return hostlessHash
	}
	pushHostlessHashInHistory(hostlessHash: string): void {
		this.pushOrReplaceHostlessHashInHistory(hostlessHash,true)
	}
	replaceHostlessHashInHistory(hostlessHash: string): void {
		this.pushOrReplaceHostlessHashInHistory(hostlessHash,false)
	}
	private pushOrReplaceHostlessHashInHistory(hostlessHash: string, push=false): void {
		const hash=attachValueToFrontOfHash('host',this.hostHashValue,hostlessHash)
		const fullHash=hash ? '#'+hash : ''
		if (fullHash!=location.hash) {
			const url=fullHash||location.pathname+location.search
			if (push) {
				history.pushState(history.state,'',url)
			} else {
				history.replaceState(history.state,'',url)
			}
		}
	}
}
