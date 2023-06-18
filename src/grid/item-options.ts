type ItemOptionsEntry = {
	get: ()=>boolean
	set: (v:boolean)=>void
	title: string
	label: string
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
			{ get: ()=>this.date    , set: v=>this.date    =v, title: 'date'    , label: '📅', },
			{ get: ()=>this.id      , set: v=>this.id      =v, title: 'id'      , label: '#', },
			{ get: ()=>this.api     , set: v=>this.api     =v, title: 'api'     , label: 'api', },
			{ get: ()=>this.editor  , set: v=>this.editor  =v, title: 'editor'  , label: '🛠️', },
			{ get: ()=>this.source  , set: v=>this.source  =v, title: 'source'  , label: '[]', },
			{ get: ()=>this.comments, set: v=>this.comments=v, title: 'comments', label: '💬', },
		]
	}
}
