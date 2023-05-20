/**
 * Creates row cells and sets with-timeline-* cell classes on a given and preceding rows
 *
 * Looks at row and cell classes
 */
export function setInsertedRowCellsAndTimeline($row: HTMLTableRowElement, iColumns: number[], columnHues: (number|null)[]): void {
	const iColumnSet=new Set(iColumns)
	for (const [iColumn,hue] of columnHues.entries()) {
		const $cell=$row.insertCell()
		setCellHue($cell,hue)
		if (iColumnSet.has(iColumn)) {
			$cell.classList.add('with-timeline-above')
		}
	}
	const reachedTimelineAbove=iColumns.map(_=>false)
	for (
		let $rowAbove=$row.previousElementSibling;
		$rowAbove && reachedTimelineAbove.some(reached=>!reached);
		$rowAbove=$rowAbove.previousElementSibling
	) {
		if (!isContentRow($rowAbove)) continue
		for (const [i,reached] of reachedTimelineAbove.entries()) {
			if (reached) continue
			const iColumn=iColumns[i]
			const $cellAbove=$rowAbove.cells[iColumn]
			if (!$cellAbove) continue
			if (!$cellAbove.classList.contains('with-timeline-above')) continue
			reachedTimelineAbove[i]=true
			$cellAbove.classList.add('with-timeline-below')
			for (
				let $rowBetween=$rowAbove.nextElementSibling;
				$rowBetween && $rowBetween!=$row;
				$rowBetween=$rowBetween.nextElementSibling
			) {
				if (!isContentRow($rowBetween)) continue
				const $cellBetween=$rowBetween.cells[iColumn]
				$cellBetween.classList.add('with-timeline-above','with-timeline-below')
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

function setCellHue($cell: HTMLTableCellElement, hue: number|null): void {
	if (hue==null) return
	$cell.style.setProperty('--hue',String(hue))
}
