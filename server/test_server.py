import unittest
from unittest.mock import patch
import asyncio
import httpx
from main import app, summary

class ServerTests(unittest.TestCase):
    def test_authentication_required(self):
        async def check():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
                return (await client.post('/api/assistant',json={'question':'Profit?'})).status_code
        self.assertEqual(asyncio.run(check()),401)
    def test_unconfigured_provider_is_not_ready(self):
        with patch.dict('os.environ',{'OPENAI_API_KEY':'','OPENAI_MODEL':''}):
            async def check():
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
                    return (await client.get('/health')).json()['ready']
            self.assertFalse(asyncio.run(check()))
    def test_summary_excludes_personal_details_and_staff_profit(self):
        facts=summary({'profile':{'role':'salesperson'},'customers':[{'cnic':'SECRET','mobile':'SECRET'}],'inventory':[],'sales':[],'payments':[],'costs':[]})
        self.assertNotIn('customers',facts)
        self.assertNotIn('gross_profit',facts)
    def test_owner_summary_includes_snapshot_profit(self):
        facts=summary({'profile':{'role':'owner'},'inventory':[],'sales':[{'final_total':115000}],'payments':[{'amount':25000}],'saleItems':[{'id':'a','item_name':'Phone','quantity':1,'final_price':115000}],'costs':[{'sale_item_id':'a','cost_price_snapshot':100000}],'expenses':[{'amount':1000}]})
        self.assertEqual(facts['gross_profit'],15000)
        self.assertEqual(facts['net_profit'],14000)
        self.assertEqual(facts['receivables'],90000)

if __name__=='__main__': unittest.main()
