import type {ItemSequenceInfo} from './info'

export default class GridBodyCollectionRow {
	constructor(private $row: HTMLTableRowElement) {}
	/**
	 * Check if all collection items are greater than the given sequence info (1), all are less than it (-1), some are greater and some are less (0)
	 */
	compare(sequenceInfo: ItemSequenceInfo): -1|0|1 {
		return 0 // TODO
	}
	/**
	 * Split collection into two rows at the given sequence info
	 */
	split(sequenceInfo: ItemSequenceInfo): void {
		// TODO
	}
	/**
	 * Insert item placeholders, adding cell icons if they were missing
	 */
	insert(sequenceInfo: ItemSequenceInfo, iColumns: number[]): HTMLElement[] {
		return [] // TODO
	}
}
