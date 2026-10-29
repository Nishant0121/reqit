export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Computes a line-by-line diff using the classic dynamic programming
 * Longest Common Subsequence (LCS) algorithm.
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const linesA = oldText.split('\n');
  const linesB = newText.split('\n');

  const m = linesA.length;
  const n = linesB.length;

  // dp table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (linesA[i] === linesB[j]) {
        dp[i + 1]![j + 1] = dp[i]![j]! + 1;
      } else {
        dp[i + 1]![j + 1] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  // Backtrack to assemble diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      stack.push({
        type: 'unchanged',
        text: linesA[i - 1]!,
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      stack.push({
        type: 'added',
        text: linesB[j - 1]!,
        newLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i]![j - 1]! < dp[i - 1]![j]!)) {
      stack.push({
        type: 'removed',
        text: linesA[i - 1]!,
        oldLineNumber: i,
      });
      i--;
    }
  }

  // Reverse backtrack stack
  while (stack.length > 0) {
    result.push(stack.pop()!);
  }

  return result;
}
