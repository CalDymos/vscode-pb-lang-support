class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(a, b, c, d) {
    if (a instanceof Position && b instanceof Position) {
      this.start = a;
      this.end = b;
      return;
    }

    this.start = new Position(a, b);
    this.end = new Position(c, d);
  }
}

class WorkspaceEdit {
  constructor() {
    this._ops = [];
  }

  replace(uri, range, newText) {
    this._ops.push({ kind: "replace", uri, range, newText });
  }

  insert(uri, position, newText) {
    this._ops.push({ kind: "insert", uri, position, newText });
  }

  delete(uri, range) {
    this._ops.push({ kind: "delete", uri, range });
  }

  getOperations() {
    return [...this._ops];
  }
}

module.exports = {
  Position,
  Range,
  WorkspaceEdit,
};
