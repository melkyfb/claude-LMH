---
name: stats
description: >
  Show LMH token savings statistics from local model executions.
  /lmh:stats — total executions, estimated tokens saved, most-used model
---

# LMH Stats

Read and aggregate the stats log:

```bash
node -e "
const fs = require('fs'), os = require('os');
const p = os.homedir() + '/.claude/lmh/stats.jsonl';
try {
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim());
  if (!lines.length) { console.log('No stats yet. Run some /lmh:local-agent tasks first.'); process.exit(0); }

  const entries = lines.map(l => JSON.parse(l));

  const total = entries.length;
  const totalSaved = entries.reduce((s, e) => s + (e.estimatedTokensSaved || 0), 0);

  const modelCounts = {};
  entries.forEach(e => { modelCounts[e.model] = (modelCounts[e.model] || 0) + 1; });
  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0];

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentEntries = entries.filter(e => new Date(e.timestamp) > weekAgo);
  const recentSaved = recentEntries.reduce((s, e) => s + (e.estimatedTokensSaved || 0), 0);

  console.log('LMH Token Savings Stats');
  console.log('────────────────────────');
  console.log('Total local executions: ' + total);
  console.log('Estimated tokens saved (all time): ' + totalSaved + '  <- estimate, not exact');
  console.log('Estimated tokens saved (last 7 days): ' + recentSaved);
  console.log('Most-used model: ' + (topModel ? topModel[0] + ' (' + topModel[1] + ' runs)' : 'none'));
  console.log('');
  console.log('Note: savings estimated as (promptLen + responseLen) x 0.75 tokens/char.');
} catch(e) {
  console.log('No stats yet. Run some /lmh:local-agent tasks first.');
}
"
```
