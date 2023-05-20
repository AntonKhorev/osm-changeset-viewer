/**
 * Creates row cells and sets with-timeline-* cell classes on a given and preceding rows
 *
 * Looks at row and cell classes
 */
export function setInsertedRowCellsAndTimeline($row: HTMLTableRowElement, iColumns: number[], columnHues: (number|null)[]): void {
	let $previousContentRow=$row.previousElementSibling
	while ($previousContentRow) {
		if (isContentRow($previousContentRow)) break
		$previousContentRow=$previousContentRow.previousElementSibling
	}
	let $nextContentRow=$row.nextElementSibling
	while ($nextContentRow) {
		if (isContentRow($nextContentRow)) break
		$nextContentRow=$nextContentRow.nextElementSibling
	}
	for (const [iColumn,hue] of columnHues.entries()) {
		const $cell=$row.insertCell()
		setCellHue($cell,hue)
		if ($previousContentRow) {
			const $previousContentCell=$previousContentRow.cells[iColumn]
			if ($previousContentCell) {
				$previousContentCell.classList.add('with-timeline-below')
			}
		}
		$cell.classList.add('with-timeline-above')
		/*
		if ($nextContentRow
		*/
	}
	/*
	for (const [iColumn,cutoffSequenceInfo] of this.columnTimelineCutoffSequenceInfo.entries()) {
		const $cell=$row.insertCell()
		if (!cutoffSequenceInfo || !isGreaterElementSequenceInfo(cutoffSequenceInfo,sequenceInfo)) {
			$cell.classList.add('with-timeline-above')
		}
		if (!cutoffSequenceInfo || isGreaterElementSequenceInfo(sequenceInfo,cutoffSequenceInfo)) {
			$cell.classList.add('with-timeline-below')
		}
	}
	*/
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
