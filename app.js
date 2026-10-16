'use strict';
const $ = id => document.getElementById(id);
let data = {tweets: []}, paused = false, loading = false;
let profiles = [], categories = {}, topics = [];
const profileFor = username => profiles.find(p => p.username.toLowerCase() === username.toLowerCase());
function matchesTopic(t) {
  const topic = topics.find(x => x.id === $("topic").value);
  const text = [t.text,...(t.github_links || [])].join(" ").toLowerCase();
  return !topic || topic.keywords.some(k => new RegExp("(^|[^a-z0-9])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)", "i").test(text));
}
const node = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
function link(text, url, cls) { const e = node('a', text, cls); e.href = url; e.target = '_blank'; e.rel = 'noopener noreferrer'; return e; }
function format(value) { return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có'; }
function render() {
  const query = $('search').value.toLocaleLowerCase('vi');
  const rows = data.tweets.filter(t => matchesTopic(t) && (!$("category").value || profileFor(t.username)?.category === $("category").value) && (!$('author').value || t.username === $('author').value) && [t.text,t.username,...(t.github_links || [])].join(' ').toLocaleLowerCase('vi').includes(query));
  $('total').textContent = data.tweets.length;
  $('results').textContent = rows.length + ' kết quả';
  $('feed').replaceChildren();
  if (!rows.length) {
    const empty = node('div', '', 'empty');
    empty.append(node('div', '⌁', 'symbol'), node('h3', data.tweets.length ? 'Không tìm thấy bài phù hợp' : 'Sẵn sàng đón những tín hiệu mới'), node('p', data.state === 'unconfigured' ? 'Thêm X_BEARER_TOKEN vào GitHub Actions để bắt đầu. Chưa có dữ liệu thật từ X; hệ thống không sử dụng bài viết giả.' : 'Chưa có bài chứa liên kết GitHub phù hợp. Kiểm tra trạng thái thu thập hoặc thay đổi bộ lọc.'));
    const button = node('button', 'Hướng dẫn kết nối'); button.onclick = () => $('help').showModal(); empty.append(button); $('feed').append(empty);
  }
  for (const t of rows) {
    const card = node('article', '', 'tweet'), head = node('div', '', 'tweet-head');
    const username = /^[A-Za-z0-9_]{1,15}$/.test(t.username) ? t.username : '';
    head.append(node('div', username.slice(0,2).toUpperCase(), 'avatar'), link('@' + username, 'https://x.com/' + username), node('time', format(t.created_at)));
    card.append(head, node('div', categories[profileFor(t.username)?.category] || 'An toàn thông tin', 'category-tag'), node('p', t.text));
    for (const url of t.github_links || []) {
      try { const parsed = new URL(url); if (parsed.protocol === 'https:' && ['github.com','www.github.com'].includes(parsed.hostname)) card.append(link('↗ ' + parsed.hostname + parsed.pathname, parsed.href, 'repo-link')); } catch {}
    }
    if (/^\d+$/.test(t.id) && username) card.append(link('Xem bài gốc trên X ↗', `https://x.com/${username}/status/${t.id}`, 'original'));
    $('feed').append(card);
  }
}
async function refresh() {
  if (loading) return;
  loading = true; $('refresh').disabled = true;
  try {
    const response = await fetch('tweets.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const next = await response.json();
    if (!Array.isArray(next.tweets)) throw new Error('Dữ liệu không hợp lệ');
    data = next;
    $('last').textContent = format(data.last_success);
    const stale = data.last_success && Date.now() - Date.parse(data.last_success) > 90 * 60000;
    const state = data.state === 'unconfigured' ? 'Chưa kết nối X API' : data.state === 'partial' ? 'Thu thập gặp lỗi' : stale ? 'Dữ liệu đã cũ' : 'Đã kết nối';
    $('health').textContent = state;
    $('notice').textContent = state + ' · ' + (data.state === 'unconfigured' ? 'Cần cấu hình secret X_BEARER_TOKEN. Xem hướng dẫn kết nối.' : `Lượt chạy gần nhất: ${format(data.checked_at)}. ` + (data.errors || []).map(e => '@' + e.username + ': ' + e.message).join(' / '));
    $('fetched').textContent = 'Trang đọc dữ liệu: ' + new Date().toLocaleTimeString('vi-VN'); render();
  } catch (error) { $('notice').textContent = 'Không tải được dữ liệu: ' + error.message + '. Giữ lại nội dung lần trước.'; }
  finally { loading = false; $('refresh').disabled = false; }
}
$('category').onchange = render; $('topic').onchange = render; $('search').oninput = render; $('author').onchange = render;
$('refresh').onclick = refresh;
$('settings').onclick = () => $('help').showModal(); $('close').onclick = () => $('help').close();
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? '▶ Tiếp tục' : 'Ⅱ Tạm dừng'; };
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { $('notice').textContent = 'Trình duyệt không hỗ trợ toàn màn hình. Có thể dùng phím F11.'; } };
function renderDirectory() {
  const q = $('directory-search').value.toLowerCase(); $('directory').replaceChildren();
  for (const p of profiles.filter(p => (p.name + ' ' + p.username).toLowerCase().includes(q))) {
    const row = node('div', '', 'directory-row');
    row.append(link(p.name + ' · @' + p.username, 'https://x.com/' + p.username), node('small', categories[p.category]), node('small', p.provenance));
    for (const source of p.sources || []) row.append(link('Nguồn tham khảo ↗', source));
    $('directory').append(row);
  }
}
$('directory-search').oninput = renderDirectory;
Promise.all(['accounts.json','topics.json'].map(url => fetch(url).then(r => {if (!r.ok) throw Error(url); return r.json();}))).then(([config, topicConfig]) => {
  profiles = config.profiles; categories = config.categories; topics = topicConfig;
  $('count').textContent = $('source-count').textContent = config.accounts.length;
  for (const [value,label] of Object.entries(categories)) { const option = node('option',label); option.value = value; $('category').append(option); }
  for (const t of topics) { const option = node('option',t.label); option.value = t.id; $('topic').append(option); }
  for (const p of profiles) { const option = node('option', p.name + ' · @' + p.username); option.value = p.username; $('author').append(option); const a = link('@' + p.username, 'https://x.com/' + p.username, 'account'); a.title = p.name + ' · ' + categories[p.category]; $('accounts').append(a); }
  renderDirectory(); render();
}).catch(() => { $('source-count').textContent = '?'; $('notice').textContent = 'Không tải được danh mục chuyên gia/chủ đề. Hãy tải lại trang.'; });
function clock() { $('clock').textContent = new Date().toLocaleTimeString('vi-VN'); }
clock(); setInterval(clock,1000); refresh(); setInterval(() => { if (!paused && !document.hidden) refresh(); },60000);
