import { Cell } from './cell.js'

const CELLS_COUNT = 36
export const cells = []

export class Grid {
	constructor(gameBoard) {
		this.gameBoard = gameBoard
		this.currentLinkedCells = 0

		for (let i = 0; i < CELLS_COUNT; i++) {
			const newCell = new Cell(this.gameBoard, i % 6, Math.floor(i / 6))
			cells.push(newCell)
		}
	}

	checkLinkedCells() {
		this.currentLinkedCells = 0
		let needReconstruct = false

		cells.forEach(cell => {
			if (cell.isLinked) {
				needReconstruct = true
				this.currentLinkedCells++
				cell.clearPoint()
			}
		})

		if (needReconstruct) {
			this.gridReconstruction()
			this.fillEmptyCell()
		}

		return this.currentLinkedCells
	}

	gridReconstruction() {
		for (let i = cells.length - 1; i >= 0; i--) {
			this.refillCell(i)
		}
	}

	refillCell(index) {
		if (cells[index].isEmpty()) {
			if (index - 6 >= 0) {
				cells[index].setNewPoint(this.refillCell(index - 6))
			}
		}

		return cells[index]
	}

	fillEmptyCell() {
		for (let i = cells.length - 1; i >= 0; i--) {
			if (cells[i].isEmpty()) {
				cells[i].createPoint()
			}
		}
	}
}
