export function setInsertedRowCellsAndTimeline($row: HTMLTableRowElement, iColumns: number[], columnHues: (number|null)[]): void {
	/*
	let $previousContentRow=$row.previousElementSibling
	while ($previousContentRow) {
		if (
			$previousContentRow instanceof HTMLTableRowElement &&
			($previousContentRow.classList.contains('item') || $previousContentRow.classList.contains('collection'))
		) break
		$previousContentRow=$previousContentRow.previousElementSibling
	}
	let $nextContentRow=$row.nextElementSibling
	while ($nextContentRow) {
		if (
			$nextContentRow instanceof HTMLTableRowElement &&
			($nextContentRow.classList.contains('item') || $nextContentRow.classList.contains('collection'))
		) break
		$nextContentRow=$nextContentRow.nextElementSibling
	}
	for (let i=0;i<this.nColumns;i++) { // TODO iterate over columnHues
		const $cell=$row.insertCell()
		if ($previousContentRow) {
			const $previousContentCell=$previousContentRow.cells[i]
			if ($previousContentCell) {
				$previousContentCell.classList.add('with-timeline-below')
			}
		}
		$cell.classList.add('with-timeline-above')
		if ($nextContentRow
	}
	*/
	/*
	for (const [iColumn,cutoffSequenceInfo] of this.columnTimelineCutoffSequenceInfo.entries()) {
		const $cell=$row.insertCell()
		if (!cutoffSequenceInfo || !isGreaterElementSequenceInfo(cutoffSequenceInfo,sequenceInfo)) {
			$cell.classList.add('with-timeline-above')
		}
		if (!cutoffSequenceInfo || isGreaterElementSequenceInfo(sequenceInfo,cutoffSequenceInfo)) {
			$cell.classList.add('with-timeline-below')
		}
		setCellHue($cell,columnHues[iColumn])
	}
	*/
}
