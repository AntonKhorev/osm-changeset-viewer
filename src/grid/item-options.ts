type ItemType = 'changeset' | 'changesetComment' | 'note' | 'noteComment' | 'user' | 'abbreviate'
function makeItemTypes(spec: `${'C'|' '}${'c'|' '}${'N'|' '}${'n'|' '}${'U'|' '}${'a'|' '}`): Set<ItemType> {
	const types: ItemType[] = []
	if (spec[0]!=' ') types.push('changeset')
	if (spec[1]!=' ') types.push('changesetComment')
	if (spec[2]!=' ') types.push('note')
	if (spec[3]!=' ') types.push('noteComment')
	if (spec[4]!=' ') types.push('user')
	if (spec[5]!=' ') types.push('abbreviate')
	return new Set(types)
}

class ItemOption {
	changeset: boolean
	changesetComment: boolean
	note: boolean
	noteComment: boolean
	user: boolean
	abbreviate=false
	constructor(
		value: boolean,
		public name: string,
		private types: Set<ItemType>,
		public label: string,
		public title?: string
	) {
		this.changeset=value
		this.changesetComment=value
		this.note=value
		this.noteComment=value
		this.user=value
	}
	hasType(type: ItemType): boolean {
		return this.types.has(type)
	}
	private get itemTypes(): ItemType[] {
		return [...this.types].filter(type=>type!='abbreviate')
	}
	get some(): boolean {
		return this.itemTypes.reduce((value,type)=>value||this[type],false)
	}
	get all(): boolean {
		return this.itemTypes.reduce((value,type)=>value&&this[type],true)
	}
	set all(value: boolean) {
		this.changeset=value
		this.changesetComment=value
		this.note=value
		this.noteComment=value
		this.user=value
	}
	get(type: string|undefined): boolean {
		if (type=='changeset' || type=='changesetComment' || type=='note' || type=='noteComment' || type=='user') {
			return this[type]
		} else if (type=='changesetClose') {
			return this.changeset
		} else {
			return this.all
		}
	}
}

export default class ItemOptions {
	private options: Map<string,ItemOption>
	allTypes: Set<ItemType>
	constructor(isExpanded: boolean) {
		this.options=new Map([
			new ItemOption(isExpanded,'date'    ,makeItemTypes('CcNnU '),'📅'),
			new ItemOption(true      ,'id'      ,makeItemTypes('CcNn a'),'#'),
			new ItemOption(isExpanded,'api'     ,makeItemTypes('CcNnU '),'api'),
			new ItemOption(isExpanded,'editor'  ,makeItemTypes('C N   '),'🛠️'),
			new ItemOption(isExpanded,'source'  ,makeItemTypes('C     '),'[]'),
			new ItemOption(isExpanded,'hot'     ,makeItemTypes('Cc    '),'hot'),
			new ItemOption(isExpanded,'position',makeItemTypes('C N   '),'⌖'),
			new ItemOption(isExpanded,'changes' ,makeItemTypes('C     '),'📝','changes count'),
			new ItemOption(isExpanded,'refs'    ,makeItemTypes('CcNn  '),'💬','comment references'),
			new ItemOption(isExpanded,'comment' ,makeItemTypes('CcNn a'),'📣'),
			new ItemOption(true      ,'status'  ,makeItemTypes('    U '),'?','status'),
		].map(option=>[option.name,option]))
		this.allTypes=makeItemTypes('CcNnU ')
	}
	[Symbol.iterator]() {
		return this.options.values()
	}
	get(name: string): ItemOption|undefined {
		return this.options.get(name)
	}
	map<T>(fn:(option:ItemOption)=>T): T[] {
		return [...this].map(fn)
	}
}
