import {JSDOM} from 'jsdom'

export function setupTestHooks() {
	const globalProperties=[
		'document',
		'HTMLElement',
		'HTMLAnchorElement',
		'HTMLButtonElement',
		'HTMLInputElement',
		'HTMLTableCellElement',
		'HTMLTableRowElement',
	]
	beforeEach(function(){
		const jsdom=new JSDOM()
		this.window=jsdom.window
		for (const property of globalProperties) {
			global[property]=jsdom.window[property]
		}
	})
	afterEach(function(){
		for (const property of globalProperties) {
			delete global[property]
		}
	})
}

export function makeRow(...$cells) {
	const $row=document.createElement('tr')
	$row.classList.add('collection')
	$row.insertCell()
	$row.append(...$cells)
	return $row
}
export function makeCell(timeline,style,...$children) {
	const $cell=document.createElement('td')
	if (timeline.includes('a')) $cell.classList.add('with-timeline-above')
	if (timeline.includes('b')) $cell.classList.add('with-timeline-below')
	$cell.setAttribute('style',style)
	const $container=document.createElement('div')
	$cell.append($container)
	if ($children.length>0) {
		const $icon=document.createElement('span')
		$icon.classList.add('icon')
		$container.append($icon)
	}
	for (const $child of $children) {
		$container.append(' ',$child)
	}
	return $cell
}
export function makeChangeset(date,id) {
	const $changeset=document.createElement('span')
	$changeset.classList.add('item','changeset','combined')
	$changeset.dataset.timestamp=Date.parse(date)
	$changeset.dataset.type='changeset'
	$changeset.dataset.id=id
	return $changeset
}
export function makeChangesetPoint(date,id) {
	return {
		timestamp: Date.parse(date),
		type: 'changeset',
		id,
	}
}
