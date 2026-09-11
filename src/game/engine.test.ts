import { describe, expect, it } from "vitest";
import {
  BOARD_COLS,
  BOARD_ROWS,
} from "./rules";
import {
  createBoard,
  isReverse,
  manhattanStep,
  queueTurn,
  setPendingDir,
  stepFrom,
  targetAt,
  tickBoard,
} from "./engine";

describe("steer helpers", () => {
  it("blocks a 180 reverse into the neck but keeps an already queued side turn", () => {
    expect(isReverse("up", "down")).toBe(true);
    expect(isReverse("left", "right")).toBe(true);
    expect(isReverse("up", "left")).toBe(false);

    expect(queueTurn("up", "up", "down")).toBe("up");
    expect(queueTurn("up", "left", "down")).toBe("left");
    expect(queueTurn("up", "up", "left")).toBe("left");
    expect(queueTurn("left", "left", "up")).toBe("up");
  });

  it("applies the queued turn on the next integer cell, never skipping", () => {
    let board = createBoard(7);
    expect(board.snake[0]).toEqual({ x: 4, y: 9 });
    expect(board.dir).toBe("up");

    board = setPendingDir(board, "left");
    expect(board.pendingDir).toBe("left");

    const first = tickBoard(board);
    expect(manhattanStep(board.snake[0]!, first.board.snake[0]!, BOARD_COLS, BOARD_ROWS)).toBe(1);
    expect(first.board.dir).toBe("left");
    expect(first.board.snake[0]).toEqual({ x: 3, y: 9 });

    const second = tickBoard(first.board);
    expect(second.board.snake[0]).toEqual({ x: 2, y: 9 });
    expect(manhattanStep(first.board.snake[0]!, second.board.snake[0]!, BOARD_COLS, BOARD_ROWS)).toBe(1);
  });

  it("ignores reverse while moving, then still accepts a later side press", () => {
    let board = createBoard(7);
    board = setPendingDir(board, "down");
    expect(board.pendingDir).toBe("up");
    board = setPendingDir(board, "right");
    expect(board.pendingDir).toBe("right");
    const moved = tickBoard(board);
    expect(moved.board.snake[0]).toEqual({ x: 5, y: 9 });
  });
});

describe("collision helpers", () => {
  it("moves exactly one grid cell per tick, including wrap", () => {
    const board = createBoard(7);
    const head = board.snake[0]!;
    const next = stepFrom(head, "up", BOARD_COLS, BOARD_ROWS);
    expect(next).toEqual({ x: 4, y: 8 });
    expect(stepFrom({ x: 0, y: 0 }, "left")).toEqual({ x: BOARD_COLS - 1, y: 0 });
    expect(stepFrom({ x: 4, y: 0 }, "up")).toEqual({ x: 4, y: BOARD_ROWS - 1 });
  });

  it("lands when the head occupies the same integer cell as a number", () => {
    const board = createBoard(7);
    const two = board.targets.find((target) => target.n === 2)!;
    expect(two.pos).toEqual({ x: 4, y: 7 });

    const first = tickBoard(board);
    expect(first.landed).toBeUndefined();
    expect(targetAt(first.board, first.board.snake[0]!)).toBeUndefined();
    expect(first.board.snake[0]).toEqual({ x: 4, y: 8 });

    const second = tickBoard(first.board);
    expect(second.board.snake[0]).toEqual({ x: 4, y: 7 });
    expect(second.landed?.n).toBe(2);
    expect(targetAt(second.board, second.board.snake[0]!)?.n).toBe(2);
  });

  it("still lands after a side trip if the head later shares a numbered cell", () => {
    let board = createBoard(7);
    board = setPendingDir(board, "left");
    board = tickBoard(board).board;
    board = setPendingDir(board, "up");
    board = tickBoard(board).board;
    board = setPendingDir(board, "right");
    const hit = tickBoard(board);
    expect(hit.board.snake[0]).toEqual({ x: 4, y: 8 });
    const toward = tickBoard(setPendingDir(hit.board, "up"));
    expect(toward.landed?.n).toBe(2);
    expect(toward.board.snake[0]).toEqual({ x: 4, y: 7 });
  });
});
