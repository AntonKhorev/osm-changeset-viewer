import {isEqualItemDescriptor, readItemDescriptor} from './info'

export function getFirstSibling($itemSet: HTMLElement[]): HTMLElement[]|null {
	if ($itemSet.length==0) return null
	const $firstItemSet:HTMLElement[]=[]
	for (const $item of $itemSet) {
		const $parent=$item.parentElement
		if (!$parent) return null
		const $firstItem=$parent.querySelector('.item')
		if (!($firstItem instanceof HTMLElement)) return null
		$firstItemSet.push($firstItem)
	}
	return $firstItemSet
}
export function getLastSibling($itemSet: HTMLElement[]): HTMLElement[]|null {
	if ($itemSet.length==0) return null
	const $lastItemSet:HTMLElement[]=[]
	for (const $item of $itemSet) {
		const $parent=$item.parentElement
		if (!$parent) return null
		const $items=$parent.querySelectorAll('.item')
		const $lastItem=$items[$items.length-1]
		if (!($lastItem instanceof HTMLElement)) return null
		$lastItemSet.push($lastItem)
	}
	return $lastItemSet
}

export function getPreviousSibling($itemSet: HTMLElement[]): HTMLElement[]|null {
	return getIteratedSibling($itemSet,$item=>$item.previousElementSibling)
}
export function getNextSibling($itemSet: HTMLElement[]): HTMLElement[]|null {
	return getIteratedSibling($itemSet,$item=>$item.nextElementSibling)
}
function getIteratedSibling($itemSet: HTMLElement[],stepElement:($item:Element)=>Element|null): HTMLElement[]|null {
	const isItem=($e:Element)=>$e.classList.contains('item')
	if ($itemSet.length==0) return null
	const $itemSet2:HTMLElement[]=[]
	for (const $item of $itemSet) {
		const $item2=stepElement($item)
		if (!($item2 instanceof HTMLElement)) return null
		$itemSet2.push($item2)
	}
	const [$leadItem2]=$itemSet2
	if (!isItem($leadItem2)) return null
	const leadDescriptor2=readItemDescriptor($leadItem2)
	if (!leadDescriptor2) return null
	for (const $item2 of $itemSet2) {
		if (!isItem($item2)) return null
		const descriptor2=readItemDescriptor($item2)
		if (!descriptor2) return null
		if (!isEqualItemDescriptor(leadDescriptor2,descriptor2)) return null
	}
	return $itemSet2
}

export function areSame($itemSet1: HTMLElement[], $itemSet2: HTMLElement[]): boolean {
	for (let i=0;i<$itemSet1.length&&i<$itemSet2.length;i++) {
		if ($itemSet1[i]!=$itemSet2[i]) return false
	}
	return true
}
