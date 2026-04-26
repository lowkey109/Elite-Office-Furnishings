import fs from "fs";

export type IssueContext = {
  filePath?: string;
  source: string;
  line?: number;
  column?: number;
  before?: string[];
  target?: string;
  after?: string[];
};

export type FixResult = {
  title: string;
  confidence: number;
  before: string;
  after: string;
  explanation: string;
} | null;

export function getIssueContext(issue: any): IssueContext | null;
export function getIssueContext(source: string, line?: number): IssueContext;
export function getIssueContext(arg1: any, arg2?: any): IssueContext | null {
  if (typeof arg1 === "string") {
    const source = arg1;
    const line = typeof arg2 === "number" ? arg2 : undefined;
    const lines = source.split("\n");
    const index = line ? Math.max(0, line - 1) : 0;

    return {
      source,
      line,
      before: lines.slice(Math.max(0, index - 5), index),
      target: lines[index],
      after: lines.slice(index + 1, index + 6),
    };
  }

  const issue = arg1;
  const filePath = issue?.file || issue?.filePath || issue?.path;

  if (!filePath || !fs.existsSync(filePath)) return null;

  const source = fs.readFileSync(filePath, "utf8");

  return {
    filePath,
    source,
    line: issue.line,
    column: issue.column,
  };
}

export function generateSimpleFix(issue: any, source: string): FixResult;
export function generateSimpleFix(line: string, fix: any): string;
export function generateSimpleFix(arg1: any, arg2: any): FixResult | string {
  if (typeof arg1 === "string") {
    const line = arg1;
    const fix = arg2;

    if (fix?.code === "TS2322" && /=\s*'(\d+)'/.test(line)) {
      return line.replace(/=\s*'(\d+)'/, "= Number('$1')");
    }

    return line;
  }

  const issue = arg1;
  const source = arg2;

  if (!issue || !issue.code || !issue.message || typeof source !== "string") {
    return null;
  }

  if (issue.code === "TS2322") {
    if (/=\s*'(\d+)'/.test(source)) {
      const fixedSource = source.replace(/=\s*'(\d+)'/, "= Number('$1')");

      return {
        title: "Fix type mismatch by casting string to number",
        confidence: 0.9,
        before: source,
        after: fixedSource,
        explanation: "Converted string to number using Number().",
      };
    }
  }

  const ts2339Match = issue.message.match(
    /Property '([^']+)' does not exist on type '([^']+)'/
  );

  if (issue.code === "TS2339" && ts2339Match) {
    const [, propertyName, typeName] = ts2339Match;

    const typeRegex = new RegExp(
      `(type\\s+${typeName}\\s*=\\s*\\{)([\\s\\S]*?)(\\n\\};)`,
      "m"
    );

    const match = source.match(typeRegex);
    if (!match) return null;

    const [fullMatch, typeStart, typeBody, typeEnd] = match;

    const existsRegex = new RegExp(`\\b${propertyName}\\??\\s*:`, "m");
    if (existsRegex.test(typeBody)) return null;

    const body = typeBody.endsWith("\n") ? typeBody : `${typeBody}\n`;
    const fixedType = `${typeStart}${body}  ${propertyName}?: any;${typeEnd}`;
    const fixedSource = source.replace(fullMatch, fixedType);

    return {
      title: `Add missing property '${propertyName}' to type '${typeName}'`,
      confidence: 0.82,
      before: source,
      after: fixedSource,
      explanation: `Added optional property '${propertyName}' to '${typeName}'.`,
    };
  }

  return null;
}
