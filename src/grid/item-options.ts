type ItemOptionsEntry = {	
	label: string
	get: ()=>boolean
	set: (v:boolean)=>void
}

export default class ItemOptions {
	date    : boolean
	id      : boolean
	api     : boolean
	editor  : boolean
	source  : boolean
	comments: boolean
	constructor(isExpanded: boolean) {
		if (isExpanded) {
			this.date    =true
			this.id      =true
			this.api     =true
			this.editor  =true
			this.source  =true
			this.comments=true
		} else {
			this.date    =false
			this.id      =true
			this.api     =false
			this.editor  =false
			this.source  =false
			this.comments=false
		}
	}
	list(): ItemOptionsEntry[] {
		return [
			{ label: 'date'    , get: ()=>this.date    , set: v=>this.date    =v },
			{ label: 'id'      , get: ()=>this.id      , set: v=>this.id      =v },
			{ label: 'api'     , get: ()=>this.api     , set: v=>this.api     =v },
			{ label: 'editor'  , get: ()=>this.editor  , set: v=>this.editor  =v },
			{ label: 'source'  , get: ()=>this.source  , set: v=>this.source  =v },
			{ label: 'comments', get: ()=>this.comments, set: v=>this.comments=v },
		]
	}
}
