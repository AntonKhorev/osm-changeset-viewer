/**
 * Sets with-timeline-* cell classes on a given and preceding rows
 *
 * Looks at row and cell classes
 */
export function updateTimelineOnInsert($row: HTMLTableRowElement, iColumns: number[]): void {
	const iColumnSet=new Set(iColumns)
	const inInsertedTimeline=new Array<boolean>($row.cells.length).fill(false)
	let $rowBelow:Element|null=$row
	while ($rowBelow.nextElementSibling) {
		$rowBelow=$rowBelow.nextElementSibling
		if (!isContentRow($rowBelow)) continue
		for (const [iColumn,$cellBelow] of [...$rowBelow.cells].entries()) {
			if ($cellBelow.classList.contains('with-timeline-above')) {
				inInsertedTimeline[iColumn]=true
			}
		}
		break
	}
	for (const [iColumn,$cell] of [...$row.cells].entries()) {
		if (inInsertedTimeline[iColumn]) {
			$cell.classList.add('with-timeline-below')
		}
		if (iColumnSet.has(iColumn) || $cell.classList.contains('with-timeline-above')) {
			inInsertedTimeline[iColumn]=true
		}
		if (inInsertedTimeline[iColumn]) {
			$cell.classList.add('with-timeline-above')
		}
	}
	let $rowAbove:Element|null=$row
	while ($rowAbove.previousElementSibling && inInsertedTimeline.some(_=>_)) {
		$rowAbove=$rowAbove.previousElementSibling
		if (!isContentRow($rowAbove)) continue
		for (const [iColumn,$cell] of [...$rowAbove.cells].entries()) {
			if (!inInsertedTimeline[iColumn]) continue
			$cell.classList.add('with-timeline-below')
			if ($cell.classList.contains('with-timeline-above')) {
				inInsertedTimeline[iColumn]=false
			} else {
				$cell.classList.add('with-timeline-above')
			}
		}
	}
}

function isContentRow($row: Element|null): $row is HTMLTableRowElement {
	return (
		$row instanceof HTMLTableRowElement &&
		($row.classList.contains('item') || $row.classList.contains('collection'))
	)
}
