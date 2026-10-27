export class VariableResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VariableResolutionError';
  }
}

export class UndefinedVariableError extends VariableResolutionError {
  public readonly variableName: string;
  private _requestName?: string;
  private _field?: string;

  constructor(variableName: string, requestName?: string, field?: string) {
    super('');
    this.name = 'UndefinedVariableError';
    this.variableName = variableName;
    this._requestName = requestName;
    this._field = field;
    this.updateMessage();
  }

  public get requestName(): string | undefined {
    return this._requestName;
  }

  public set requestName(val: string | undefined) {
    this._requestName = val;
    this.updateMessage();
  }

  public get field(): string | undefined {
    return this._field;
  }

  public set field(val: string | undefined) {
    this._field = val;
    this.updateMessage();
  }

  private updateMessage(): void {
    let msg = `Undefined variable: "${this.variableName}"`;
    if (this._requestName) {
      msg += ` in request "${this._requestName}"`;
    }
    if (this._field) {
      msg += ` (field: ${this._field})`;
    }
    this.message = msg;
  }
}

export class VariableCycleError extends VariableResolutionError {
  public readonly chain: string[];
  public readonly variableName: string;

  constructor(chain: string[]) {
    const chainStr = chain.join(' -> ');
    super(`Variable cycle detected: ${chainStr}`);
    this.name = 'VariableCycleError';
    this.chain = chain;
    this.variableName = chain[0] ?? '';
  }
}
