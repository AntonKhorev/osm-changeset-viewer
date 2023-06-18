type ItemOptionsEntry = {	
	label: string
	get: ()=>boolean
	set: (v:boolean)=>void
}

export default class ItemOptions {
	api     : boolean
	editor  : boolean
	source  : boolean
	comments: boolean
	constructor(isExpanded: boolean) {
		if (isExpanded) {
			this.api     =true
			this.editor =true
			this.source =true
			this.comments=true
		} else {
			this.api     =false
			this.editor  =false
			this.source  =false
			this.comments=false
		}
	}
	list(): ItemOptionsEntry[] {
		return [
			{ label: 'api'     , get: ()=>this.api     , set: v=>this.api     =v },
			{ label: 'editor'  , get: ()=>this.editor  , set: v=>this.editor  =v },
			{ label: 'source'  , get: ()=>this.source  , set: v=>this.source  =v },
			{ label: 'comments', get: ()=>this.comments, set: v=>this.comments=v },
		]
	}
}
