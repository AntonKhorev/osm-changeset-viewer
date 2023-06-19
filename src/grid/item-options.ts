type ItemOptionsEntry = {
	get: ()=>boolean
	set: (v:boolean)=>void
	name: string
	label: string
}

export default class ItemOptions {
	date    : boolean
	id      : boolean
	api     : boolean
	editor  : boolean
	source  : boolean
	changes : boolean
	comments: boolean
	list: ItemOptionsEntry[]
	constructor(isExpanded: boolean) {
		if (isExpanded) {
			this.date    =true
			this.id      =true
			this.api     =true
			this.editor  =true
			this.source  =true
			this.changes =true
			this.comments=true
		} else {
			this.date    =false
			this.id      =true
			this.api     =false
			this.editor  =false
			this.source  =false
			this.changes =false
			this.comments=false
		}
		this.list=[
			{ get: ()=>this.date    , set: v=>this.date    =v, name: 'date'    , label: '📅', },
			{ get: ()=>this.id      , set: v=>this.id      =v, name: 'id'      , label: '#', },
			{ get: ()=>this.api     , set: v=>this.api     =v, name: 'api'     , label: 'api', },
			{ get: ()=>this.editor  , set: v=>this.editor  =v, name: 'editor'  , label: '🛠️', },
			{ get: ()=>this.source  , set: v=>this.source  =v, name: 'source'  , label: '[]', },
			{ get: ()=>this.changes , set: v=>this.changes =v, name: 'changes' , label: '📝', },
			{ get: ()=>this.comments, set: v=>this.comments=v, name: 'comments', label: '💬', },
		]
	}
}
