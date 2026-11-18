function normalizeClaim(value) {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ').replace(/[.]$/u, '');
}

export function findComparisons(claim, topics) {
  const normalized = normalizeClaim(claim);
  if (!normalized) return { example: null, topics: [] };
  const example = topics.find(topic => normalizeClaim(topic.example) === normalized);
  if (example) return { example, topics: [example] };

  const text = normalized.replace(/\s+/gu, '');
  const related = topics.flatMap(topic => {
    const terms = topic.keywords.map(word => word.replace(/\s+/gu, ''));
    const longest = Math.max(0, ...terms.filter(word => text.includes(word)).map(word => word.length));
    return longest ? [{ topic, longest }] : [];
  }).sort((a, b) => b.longest - a.longest);
  return { example: null, topics: related.slice(0, 3).map(item => item.topic) };
}

function judgmentKey(value) {
  return value.normalize('NFC').replace(/[\p{P}\s]+/gu, '');
}

export function findLocalJudgment(claim, topics, judgments) {
  const key = judgmentKey(claim);
  const judgment = judgments.find(caseData =>
    [caseData.proposition, ...caseData.aliases].some(text => judgmentKey(text) === key));
  if (judgment) return judgment;
  const topic = topics.find(topic => judgmentKey(topic.example) === key);
  if (!topic) return null;
  return {
    verdict: topic.relation === 'agrees' ? 'agrees' : 'conflicts',
    proposition: topic.example,
    reason: topic.explanation,
    sources: topic.references,
  };
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

const verdicts = {
  agrees: '일치',
  similar: '유사',
  conflicts: '충돌',
  varies: '문헌별 차이',
  insufficient: '근거 부족',
};

function renderSource(reference, showRelation = false, sourceOrigin = '') {
  const row = node('li');
  const link = node('a', reference.label);
  link.href = sourceOrigin + reference.path;
  if (sourceOrigin) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  const quote = node('blockquote');
  if (reference.question) quote.append(node('p', reference.question, 'comparison-question'));
  quote.append(node('p', reference.text));
  row.append(link);
  if (reference.excerpt) row.append(node('span', '발췌', 'comparison-summary-label'));
  row.append(quote);
  if (reference.explanation) {
    if (showRelation && verdicts[reference.relation]) {
      row.append(node('p', verdicts[reference.relation], 'comparison-relation'));
    }
    row.append(node('p', reference.explanation, 'comparison-explanation'));
  }
  return row;
}

function renderTopic(topic, example, sourceOrigin) {
  const section = node('section', '', 'comparison-topic');
  section.append(node('h3', topic.name), node('p', topic.scope, 'comparison-topic-scope'));
  if (example) {
    const relation = example.relation === 'agrees'
      ? '예시 문장이 아래 고백과 일치합니다.'
      : '예시 문장이 아래 고백과 다릅니다.';
    section.append(node('p', relation, 'comparison-relation'), node('p', example.explanation));
  }
  const sources = node('ul', '', 'comparison-sources');
  sources.append(...topic.references.map(reference => renderSource(reference, false, sourceOrigin)));
  section.append(sources);
  return section;
}

export function isComparisonResult(result) {
  if (!result || !Object.hasOwn(verdicts, result.verdict) || typeof result.reason !== 'string'
      || !Array.isArray(result.sources)) return false;
  if (result.verdict === 'insufficient') return result.sources.length === 0;
  return typeof result.proposition === 'string' && result.sources.length > 0
    && result.sources.length <= 6 && result.sources.every(source => source
      && ['agrees', 'conflicts'].includes(source.relation)
      && typeof source.path === 'string' && /^\/works\/[a-z0-9-]+\/index\.html#p-[a-zA-Z0-9.-]+$/u.test(source.path)
      && ['label', 'text', 'question', 'explanation'].every(key => typeof source[key] === 'string'));
}

export function installComparison({ requestComparison, sourceOrigin = '', demoExamples = {} } = {}) {
  const form = document.getElementById('claim-form');
  const field = document.getElementById('claim');
  const results = document.getElementById('comparison-results');
  const heading = document.getElementById('comparison-heading');
  const content = document.getElementById('comparison-content');
  const status = document.getElementById('comparison-status');
  const topics = JSON.parse(document.getElementById('comparison-data').textContent);
  const judgments = JSON.parse(document.getElementById('comparison-judgments').textContent);
  const submit = form.querySelector('button[type="submit"]');
  const endpoint = form.dataset.api;
  const canCompare = Boolean(requestComparison || endpoint);
  let activeRequest = null;

  function finishRequest() {
    activeRequest = null;
    submit.disabled = false;
    submit.textContent = '신앙고백과 비교';
  }

  function clearResults() {
    activeRequest?.abort();
    finishRequest();
    field.setCustomValidity('');
    results.hidden = true;
    content.replaceChildren();
    status.textContent = '';
  }

  function show(title, nodes, announcement) {
    heading.textContent = title;
    content.replaceChildren(...nodes);
    results.hidden = false;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    status.textContent = announcement;
  }

  function showRelated(claim, message) {
    const match = findComparisons(claim, topics);
    const nodes = [node('blockquote', claim, 'comparison-claim')];
    if (message) nodes.push(node('p', message, 'comparison-message'));
    let title;
    if (!message) {
      title = verdicts.insufficient;
      const guidance = match.topics.length
        ? '이 진술은 판정하기 어렵습니다. 관련 주제의 조항을 살펴보세요.'
        : '이 진술에 맞는 근거 조항을 찾지 못했습니다. 한 가지 주장이나 주제로 줄여 보세요.';
      nodes.push(node('p', guidance));
      if (!match.topics.length) {
        const catalogueLink = node('a', '문헌 본문 검색', 'comparison-search-link');
        catalogueLink.href = new URL('../index.html#q', sourceOrigin || document.baseURI);
        nodes.push(catalogueLink);
      }
    } else if (match.example) {
      title = '예시 문장과 신앙고백';
    } else if (match.topics.length) {
      title = '관련 신앙고백 조항';
      nodes.push(node('p', '문장에서 찾은 주제에 해당하는 조항입니다. 입력문과 조항을 직접 대조해 보세요.'));
    } else {
      title = '관련 조항을 찾지 못했습니다';
      nodes.push(node('p', '문장을 한 가지 주장으로 줄이거나 예시의 주제를 넣어 보세요.'));
    }
    nodes.push(...match.topics.map(topic => renderTopic(topic, match.example, sourceOrigin)));
    show(title, nodes, '관련 주제 ' + match.topics.length + '개');
  }

  function showVerdict(claim, result) {
    const nodes = [node('blockquote', claim, 'comparison-claim')];
    if (result.proposition && normalizeClaim(result.proposition) !== normalizeClaim(claim)) {
      const summary = node('p', '', 'comparison-summary');
      summary.append(node('span', '비교한 주장', 'comparison-summary-label'), node('span', result.proposition));
      nodes.push(summary);
    }
    nodes.push(node('p', result.reason, 'comparison-summary'));
    if (result.sources.length) {
      const sources = node('ul', '', 'comparison-sources');
      sources.append(...result.sources.map(reference => renderSource(reference, result.verdict === 'varies', sourceOrigin)));
      nodes.push(sources);
    }
    const verdict = verdicts[result.verdict];
    show(verdict, nodes, verdict + '. 근거 조항 ' + result.sources.length + '개');
  }

  async function compare() {
    if (activeRequest) return;
    const claim = field.value.trim();
    clearResults();
    if (!normalizeClaim(claim)) {
      field.setCustomValidity(canCompare ? '질문이나 주장을 입력해 주세요.' : '비교할 문장을 입력해 주세요.');
      field.reportValidity();
      return;
    }
    if (!canCompare) {
      showLocal(claim);
      return;
    }
    const controller = new AbortController();
    activeRequest = controller;
    submit.disabled = true;
    submit.textContent = '비교 중';
    status.textContent = '신앙고백 조항을 비교하고 있습니다.';
    let message = '지금은 자동 비교를 이용할 수 없습니다.';
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]);
      const response = requestComparison ? await requestComparison(claim, signal) : await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim }),
        credentials: 'omit',
        redirect: 'error',
        signal,
      });
      const result = await response.json();
      if (activeRequest !== controller) return;
      if (response.ok && isComparisonResult(result)) {
        showVerdict(claim, result);
        return;
      }
      if (result?.error === 'free_credits_unavailable') {
        message = '지금은 무료 크레딧을 사용할 수 없어 자동 비교가 중단됐습니다.';
      }
    } catch {
      if (activeRequest !== controller) return;
    } finally {
      if (activeRequest === controller) finishRequest();
    }
    showRelated(claim, message);
  }

  function showLocal(claim) {
    const judgment = findLocalJudgment(claim, topics, judgments);
    if (judgment) showVerdict(claim, judgment);
    else showRelated(claim);
  }

  form.addEventListener('submit', event => { event.preventDefault(); compare(); });
  form.addEventListener('reset', () => { clearResults(); field.focus(); });
  field.addEventListener('input', clearResults);
  form.querySelector('.claim-example-links').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const caseData = judgments[button.dataset.judgment];
    if (caseData) {
      clearResults();
      field.value = caseData.proposition;
      showVerdict(caseData.proposition, caseData);
      return;
    }
    if (button && Object.hasOwn(demoExamples, button.dataset.topic)) {
      clearResults();
      field.value = demoExamples[button.dataset.topic];
      compare();
      return;
    }
    const topic = topics.find(item => item.id === button.dataset.topic);
    if (!topic) return;
    clearResults();
    field.value = topic.example;
    showLocal(topic.example);
  });
  form.hidden = false;
}

if (typeof document !== 'undefined' && !document.querySelector('#claim-form[data-demo]')) {
  installComparison();
}
