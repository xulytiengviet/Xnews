import unittest
from unittest.mock import patch
from datetime import datetime, timezone
import monitor

class CollectorTests(unittest.TestCase):
    def test_exact_github_host(self):
        self.assertEqual(monitor.github_links({'text':'https://github.com.evil.test/a https://evil.test/github.com'}), [])
        self.assertEqual(monitor.github_links({'entities':{'urls':[{'expanded_url':'https://github.com/a/b'}]}}), ['https://github.com/a/b'])

    def test_pagination_keeps_since_id(self):
        with patch.object(monitor, 'api', side_effect=[{'data':[{'id':'12'}], 'meta':{'next_token':'next'}}, {'data':[{'id':'11'}]}]) as api:
            rows = monitor.collect('1', '10', datetime.now(timezone.utc))
            self.assertEqual([r['id'] for r in rows], ['12','11'])
            self.assertEqual(api.call_args.args[1]['since_id'], '10')
            self.assertEqual(api.call_args.args[1]['pagination_token'], 'next')

    def test_partial_page_failure_does_not_return_success(self):
        with patch.object(monitor, 'api', side_effect=[{'data':[{'id':'12'}], 'meta':{'next_token':'next'}}, ValueError('failure')]):
            with self.assertRaises(ValueError):
                monitor.collect('1', '10', datetime.now(timezone.utc))

    def test_no_token_does_not_call_api(self):
        with patch.dict('os.environ', {}, clear=True), patch.object(monitor, 'api') as api, patch.object(monitor, 'write') as write:
            self.assertEqual(monitor.main(), 0)
            api.assert_not_called()
            self.assertEqual(write.call_args.args[1]['state'], 'unconfigured')

if __name__ == '__main__':
    unittest.main()
