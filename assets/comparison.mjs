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

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderTopic(topic, example) {
  const section = node('section', '', 'comparison-topic');
  section.append(node('h3', topic.name), node('p', topic.scope, 'comparison-topic-scope'));
  if (example) {
    const relation = example.relation === 'agrees'
      ? '예시 문장이 아래 고백과 일치합니다.'
      : '예시 문장이 아래 고백과 다릅니다.';
    section.append(node('p', relation, 'comparison-relation'), node('p', example.explanation));
  }
  const sources = node('ul', '', 'comparison-sources');
  for (const reference of topic.references) {
    const row = node('li');
    const link = node('a', reference.label);
    link.href = reference.path;
    const quote = node('blockquote');
    if (reference.question) quote.append(node('p', reference.question, 'comparison-question'));
    quote.append(node('p', reference.text));
    row.append(link, quote);
    sources.append(row);
  }
  section.append(sources);
  return section;
}

function install() {
  const form = document.getElementById('claim-form');
  const field = document.getElementById('claim');
  const results = document.getElementById('comparison-results');
  const heading = document.getElementById('comparison-heading');
  const content = document.getElementById('comparison-content');
  const status = document.getElementById('comparison-status');
  const topics = JSON.parse(document.getElementById('comparison-data').textContent);

  function clearResults() {
    field.setCustomValidity('');
    results.hidden = true;
    content.replaceChildren();
    status.textContent = '';
  }

  function compare() {
    const claim = field.value.trim();
    if (!normalizeClaim(claim)) {
      clearResults();
      field.setCustomValidity('비교할 문장을 입력해 주세요.');
      field.reportValidity();
      return;
    }
    const match = findComparisons(claim, topics);
    const nodes = [node('blockquote', claim, 'comparison-claim')];
    if (match.example) {
      heading.textContent = '예시 문장과 신앙고백';
    } else if (match.topics.length) {
      heading.textContent = '관련 신앙고백 조항';
      nodes.push(node('p', '문장에서 찾은 주제에 해당하는 조항입니다. 입력문과 조항을 직접 대조해 보세요.'));
    } else {
      heading.textContent = '관련 조항을 찾지 못했습니다';
      nodes.push(node('p', '문장을 한 가지 주장으로 줄이거나 예시의 주제를 넣어 보세요.'));
    }
    nodes.push(...match.topics.map(topic => renderTopic(topic, match.example)));
    content.replaceChildren(...nodes);
    results.hidden = false;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    status.textContent = '관련 주제 ' + match.topics.length + '개';
  }

  form.addEventListener('submit', event => { event.preventDefault(); compare(); });
  form.addEventListener('reset', () => { clearResults(); field.focus(); });
  field.addEventListener('input', clearResults);
  form.querySelector('.claim-example-links').addEventListener('click', event => {
    const button = event.target.closest('button[data-topic]');
    const topic = button && topics.find(item => item.id === button.dataset.topic);
    if (!topic) return;
    field.setCustomValidity('');
    field.value = topic.example;
    compare();
  });
  form.hidden = false;
}

if (typeof document !== 'undefined') install();
