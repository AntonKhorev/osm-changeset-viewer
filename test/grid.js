import {strict as assert} from 'assert'
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

export function makeSingleRow(...$cells) {
	const $row=document.createElement('tr')
	$row.classList.add('single')
	$row.insertCell()
	$row.append(...$cells)
	return $row
}
export function makeCollectionRow(...$cells) {
	const $row=document.createElement('tr')
	$row.classList.add('collection')
	$row.insertCell()
	for (const $cell of $cells) {
		const [$container]=$cell.children
		if ($container && $container.children.length>0) {
			const $icon=document.createElement('span')
			$icon.classList.add('icon')
			$container.prepend($icon,' ')
		}
		$row.append($cell)
	}
	return $row
}
export function makeCell(timeline,color,...$children) {
	const $cell=document.createElement('td')
	if (timeline.includes('a')) $cell.classList.add('with-timeline-above')
	if (timeline.includes('b')) $cell.classList.add('with-timeline-below')
	$cell.dataset.hueUid=String(color.uid)
	$cell.style.setProperty('--hue',String(color.hue))
	$cell.style.setProperty('--saturation-factor','1')
	const $container=document.createElement('div')
	$cell.append($container)
	let first=true
	for (const $child of $children) {
		if (first) {
			first=false
		} else {
			$container.append(' ')
		}
		$container.append($child)
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

export function assertChangesetSingleRow($row,cells) {
	assertChangesetRow($row,cells,false)
}
export function assertChangesetCollectionRow($row,cells) {
	assertChangesetRow($row,cells,true)
}
function assertChangesetRow($row,cells,isCollection) {
	assert($row.classList.contains(isCollection?'collection':'single'))
	assert.equal($row.cells.length,cells.length)
	for (let i=0;i<cells.length;i++) {
		const $cell=$row.cells[i]
		const [timeline,color,...items]=cells[i]
		if (timeline!=null) {
			assertTimelineClasses($cell,timeline,`cell[${i}]`)
		}
		if (color!=null) {
			assert.equal($cell.dataset.hueUid,String(color.uid))
			assert.equal($cell.style.getPropertyValue('--hue'),String(color.hue))
		}
		if (items.length==0) {
			assert($cell.children.length==0 || $cell.children.length==1)
			if ($cell.children.length==1) {
				const [$container]=$cell.children
				assert.equal($container.children.length,0)
			}
		} else {
			assert.equal($cell.children.length,1)
			const [$container]=$cell.children
			if (items.length==0) {
				if ($container) {
					assert.equal($container.children.length,0)
				}
				continue
			}
			const iChild=iItem=>(iItem*2)+(isCollection?2:0)
			assert.equal($container.childNodes.length,iChild(items.length)-1,`Expected cell[${i}] to have ${iChild(items.length)-1} child nodes, got ${$container.childNodes.length}`)
			if (isCollection) {
				const $icon=$container.children[0]
				assert($icon.classList.contains('icon'))
			}
			for (let j=0;j<items.length;j++) {
				if (isCollection || j>0) {
					const $space=$container.childNodes[iChild(j)-1]
					assert.equal($space.nodeType,document.TEXT_NODE)
					assert.equal($space.textContent,' ')
				}
				const $item=$container.childNodes[iChild(j)]
				assert.equal($item.nodeType,document.ELEMENT_NODE)
				const point=makeChangesetPoint(...items[j])
				assert.equal($item.dataset.type,point.type)
				assert.equal($item.dataset.id,String(point.id),`Expected item[${i},${j}] to have id '${point.id}', got '${$item.dataset.id}'`)
				assert.equal($item.dataset.timestamp,String(point.timestamp))
			}
		}
	}
}
function assertTimelineClasses($cell,keys,cellName='cell') {
	for (const [key,word] of [['a','above'],['b','below']]) {
		const className=`with-timeline-${word}`
		if (keys.includes(key)) {
			assert($cell.classList.contains(className),`Expected ${cellName} class '${className}' missing`)
		} else {
			assert(!$cell.classList.contains(className),`Unexpected ${cellName} class '${className}' present`)
		}
	}
}
