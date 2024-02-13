import { Grid } from './grid.js'
import { Tile } from './tile.js'

let score = 0

const gameBoard = document.getElementById('game-board')

const grid = new Grid(gameBoard)
grid.getRandomEmptyCell().linkTile(new Tile(gameBoard))
grid.getRandomEmptyCell().linkTile(new Tile(gameBoard))
setupInputOnce()

function setupInputOnce() {
	window.addEventListener('keydown', handleInput, { once: true })
}

async function handleInput(event) {
	switch (event.key) {
		case 'ArrowUp':
			if (!canMoveUp()) {
				setupInputOnce()
				return
			}

			await moveUp()
			break

		case 'ArrowDown':
			if (!canMoveDown()) {
				setupInputOnce()
				return
			}

			await moveDown()
			break

		case 'ArrowLeft':
			if (!canMoveLeft()) {
				setupInputOnce()
				return
			}

			await moveLeft()
			break

		case 'ArrowRight':
			if (!canMoveRight()) {
				setupInputOnce()
				return
			}

			await moveRight()
			break

		default:
			setupInputOnce()
			return
	}

	const newTile = new Tile(gameBoard)
	grid.getRandomEmptyCell().linkTile(newTile)

	if (!canMoveUp() && !canMoveDown() && !canMoveLeft() && !canMoveRight()) {
		await newTile.waitForAnimationEnd()
		gameOver()
	}

	setupInputOnce()
}

async function moveUp() {
	await slideTiles(grid.cellsGroupedByColumn)
}

async function moveDown() {
	await slideTiles(grid.cellsGroupedByReversedColumn)
}

async function moveLeft() {
	await slideTiles(grid.cellsGroupedByRow)
}

async function moveRight() {
	await slideTiles(grid.cellsGroupedByReversedRow)
}

async function slideTiles(groupedCells) {
	const promises = []

	groupedCells.forEach(group => slideTilesInGroup(group, promises))

	await Promise.all(promises)

	grid.cells.forEach(cell => {
		if (cell.hasTileForMerge()) {
			score += cell.mergeTiles()
			counter(score)
		}
	})
}

function counter(target) {
	const timeToEnd = 100 //ms
	const time = 10
	const step = Math.ceil(target / timeToEnd)

	const element = document.querySelector(`#score`)
	let currentNumber = Number(element.innerHTML)

	const interval = setInterval(() => {
		currentNumber += step

		if (currentNumber >= target) {
			element.innerHTML = target
			clearInterval(interval)
		} else {
			element.innerHTML = currentNumber
		}
	}, time)
}

function slideTilesInGroup(group, promises) {
	for (let i = 1; i < group.length; i++) {
		if (group[i].isEmpty()) {
			continue
		}

		const cellWithTile = group[i]

		let targetCell
		let j = i - 1

		while (j >= 0 && group[j].canAccept(cellWithTile.linkedTile)) {
			targetCell = group[j]
			j--
		}

		if (!targetCell) {
			continue
		}

		promises.push(cellWithTile.linkedTile.waitForTransitionEnd())

		if (targetCell.isEmpty()) {
			targetCell.linkTile(cellWithTile.linkedTile)
		} else {
			targetCell.linkTileForMerge(cellWithTile.linkedTile)
		}

		cellWithTile.unlinkTile()
	}
}

function canMoveUp() {
	return canMove(grid.cellsGroupedByColumn)
}

function canMoveDown() {
	return canMove(grid.cellsGroupedByReversedColumn)
}

function canMoveLeft() {
	return canMove(grid.cellsGroupedByRow)
}

function canMoveRight() {
	return canMove(grid.cellsGroupedByReversedRow)
}

function canMove(groupedCells) {
	return groupedCells.some(group => canMoveInGroup(group))
}

function canMoveInGroup(group) {
	return group.some((cell, index) => {
		if (index === 0) return false

		if (cell.isEmpty()) return false

		const targetCell = group[index - 1]
		return targetCell.canAccept(cell.linkedTile)
	})
}

function gameOver() {
	confirm('Начать заново?') ? reloadGame() : history.back()
}

function reloadGame() {
	location.reload()
}
