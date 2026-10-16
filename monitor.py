"""X API collector. No external dependencies. Credentials only in environment."""
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent

def read(name, default):
    path = ROOT / name
    return json.loads(path.read_text()) if path.exists() else default

def write(name, value):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)

def github_links(tweet):
    urls = [u.get('unwound_url') or u.get('expanded_url', '') for u in tweet.get('entities', {}).get('urls', [])]
    urls += re.findall(r'https?://[^\s<>]+', tweet.get('text', ''))
    return sorted({u for u in urls if urlparse(u).hostname in ('github.com', 'www.github.com') and urlparse(u).scheme == 'https'})

def api(path, params=None):
    url = 'https://api.x.com/2/' + path
    if params:
        url += '?' + urlencode(params)
    req = Request(url, headers={'Authorization': 'Bearer ' + os.environ['X_BEARER_TOKEN']})
    with urlopen(req, timeout=30) as response:
        result = json.load(response)
    if result.get('errors'):
        raise ValueError('X trả về dữ liệu không đầy đủ')
    return result

def collect(uid, checkpoint, now):
    params = {'max_results': 100, 'tweet.fields': 'created_at,entities', 'exclude': 'replies,retweets'}
    if checkpoint:
        params['since_id'] = checkpoint
    else:
        params['start_time'] = (now - timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%SZ')
    rows = []
    for _ in range(20):
        page = api(f'users/{uid}/tweets', params)
        rows.extend(page.get('data', []))
        token = page.get('meta', {}).get('next_token')
        if not token:
            return rows
        params['pagination_token'] = token
    raise ValueError('Vượt 20 trang; giữ nguyên mốc để tránh mất bài. Cần tăng giới hạn hoặc thu hẹp khoảng thu thập.')

def main():
    now = datetime.now(timezone.utc)
    accounts = read('accounts.json', {})['accounts']
    if not all(re.fullmatch(r'[A-Za-z0-9_]{1,15}', a) for a in accounts):
        raise ValueError('Username không hợp lệ')
    previous = read('tweets.json', {'tweets': [], 'last_success': None})
    status = {'checked_at': now.isoformat(), 'last_success': previous.get('last_success'), 'accounts': len(accounts), 'errors': [], 'state': 'ready'}
    state = read('state/checkpoints.json', {})
    rows = {t['id']: t for t in previous['tweets']}
    if not os.getenv('X_BEARER_TOKEN'):
        status.update(state='unconfigured', tweets=list(rows.values()))
        write('tweets.json', status)
        print('Chưa cấu hình X_BEARER_TOKEN; không gọi API.')
        return 0
    for username in accounts:
        saved = state.get(username, {})
        try:
            uid = saved.get('user_id') or api('users/by/username/' + username)['data']['id']
            tweets = collect(uid, saved.get('since_id'), now)
            for tweet in tweets:
                links = github_links(tweet)
                if links:
                    rows[tweet['id']] = {**{k: tweet.get(k, '') for k in ('id', 'text', 'created_at')}, 'username': username, 'github_links': links}
            state[username] = {'user_id': uid, 'since_id': max([t['id'] for t in tweets], key=int) if tweets else saved.get('since_id')}
        except Exception as error:
            code = error.code if isinstance(error, HTTPError) else None
            message = f'HTTP {code}' if code else 'Lỗi mạng hoặc dữ liệu; giữ nguyên mốc thu thập'
            status['errors'].append({'username': username, 'message': message})
            if code in (401, 402, 403, 429):
                status['errors'].append({'username': 'system', 'message': 'Dừng lượt thu thập; kiểm tra quyền API, ngân sách hoặc giới hạn truy cập.'})
                break
    status['state'] = 'partial' if status['errors'] else 'ready'
    if not status['errors']:
        status['last_success'] = now.isoformat()
    status['tweets'] = sorted(rows.values(), key=lambda t: int(t['id']), reverse=True)[:200]
    # Output first: interruption cannot advance checkpoints past unwritten posts.
    write('tweets.json', status)
    write('state/checkpoints.json', state)
    print(f"Trạng thái: {status['state']}; {len(status['tweets'])} bài; {len(status['errors'])} lỗi.")
    return 1 if status['errors'] else 0

if __name__ == '__main__':
    sys.exit(main())
