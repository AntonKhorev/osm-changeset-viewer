type ItemType = 'changeset' | 'changesetComment' | 'note' | 'noteComment'
function makeItemTypes(spec: `${'C'|' '}${'c'|' '}${'N'|' '}${'n'|' '}`): Set<ItemType> {
	const types: ItemType[] = []
	if (spec[0]!=' ') types.push('changeset')
	if (spec[1]!=' ') types.push('changesetComment')
	if (spec[2]!=' ') types.push('note')
	if (spec[3]!=' ') types.push('noteComment')
	return new Set(types)
}

class ItemOption {
	changeset: boolean
	changesetComment: boolean
	note: boolean
	noteComment: boolean
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
	}
	hasType(type: ItemType): boolean {
		return this.types.has(type)
	}
	get some(): boolean {
		return [...this.types].reduce((value,type)=>value||this[type],false)
	}
	get all(): boolean {
		return [...this.types].reduce((value,type)=>value&&this[type],true)
	}
	set all(value: boolean) {
		this.changeset=value
		this.changesetComment=value
		this.note=value
		this.noteComment=value
	}
	get(type: string|undefined): boolean {
		if (type=='changeset' || type=='changesetComment' || type=='note' || type=='noteComment') {
			return this[type]
		} else if (type=='changesetClose') {
			return this.changeset
		} else { // TODO add user type
			return this.all
		}
	}
}

export default class ItemOptions {
	private options: Map<string,ItemOption>
	allTypes: Set<ItemType>
	constructor(isExpanded: boolean) {
		this.options=new Map([
			new ItemOption(isExpanded,'date'   ,makeItemTypes('CcNn'),'📅'),
			new ItemOption(true      ,'id'     ,makeItemTypes('CcNn'),'#'),
			new ItemOption(isExpanded,'api'    ,makeItemTypes('CcNn'),'api'),
			new ItemOption(isExpanded,'editor' ,makeItemTypes('C N '),'🛠️'),
			new ItemOption(isExpanded,'source' ,makeItemTypes('C   '),'[]'),
			new ItemOption(isExpanded,'changes',makeItemTypes('C   '),'📝','changes count'),
			new ItemOption(isExpanded,'refs'   ,makeItemTypes('C N '),'💬','comment references'),
			new ItemOption(isExpanded,'comment',makeItemTypes('CcNn'),'📣'),
		].map(option=>[option.name,option]))
		this.allTypes=makeItemTypes('CcNn')
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
