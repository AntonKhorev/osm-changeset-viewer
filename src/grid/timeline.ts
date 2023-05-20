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
		let $previousRowAbove:Element|null=null, $rowAbove=$row.previousElementSibling;
		reachedTimelineAbove.some(reached=>!reached);
		$previousRowAbove=$rowAbove, $rowAbove=$rowAbove.previousElementSibling
	) {
		if ($rowAbove) {
			if (!isContentRow($rowAbove)) continue
		}
		for (const [i,reached] of reachedTimelineAbove.entries()) {
			if (reached) continue
			const iColumn=iColumns[i]
			let $rowBetween: Element|null
			if ($rowAbove) {
				const $cellAbove=$rowAbove.cells[iColumn]
				if (!$cellAbove) continue
				if (!$cellAbove.classList.contains('with-timeline-above')) continue
				$cellAbove.classList.add('with-timeline-below')
				$rowBetween=$rowAbove.nextElementSibling
			} else {
				$rowBetween=$previousRowAbove
			}
			reachedTimelineAbove[i]=true
			for (
				;
				$rowBetween && $rowBetween!=$row;
				$rowBetween=$rowBetween.nextElementSibling
			) {
				if (!isContentRow($rowBetween)) continue
				const $cellBetween=$rowBetween.cells[iColumn]
				$cellBetween.classList.add('with-timeline-above','with-timeline-below')
			}
		}
		if (!$rowAbove) break
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
