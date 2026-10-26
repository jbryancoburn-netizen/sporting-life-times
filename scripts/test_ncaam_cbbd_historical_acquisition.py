#!/usr/bin/env python3
"""Offline historical acquisition boundary and truncation checks."""
import datetime
import sys
from pathlib import Path
sys.path.insert(0,str(Path("scripts").resolve()))
import acquire_ncaam_cbbd_pre1985 as m
from unittest.mock import patch
class Response:
 def __init__(self,body):self.body=body
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def read(self):return self.body
with patch.object(m.urllib.request,"urlopen",return_value=Response(b'[{"id":1}]')) as fake:
 result=m.fetch("unit-test",1950,datetime.date(1949,10,1),datetime.date(1949,10,14))
 assert result==[{"id":1}]
 req=fake.call_args.args[0]
 assert "startDateRange=1949-10-01T00%3A00%3A00Z" in req.full_url
 assert "endDateRange=1949-10-14T23%3A59%3A59Z" in req.full_url
 assert req.get_header("Authorization")=="Bearer unit-test"
with patch.object(m.urllib.request,"urlopen",return_value=Response(b"["+b'{"id":1},'*2999+b'{"id":2}]')):
 try:m.fetch("unit-test",1950,datetime.date(1949,10,1),datetime.date(1949,10,14))
 except ValueError as e:assert "truncated" in str(e)
 else:raise AssertionError("Truncated window accepted")
print("PASS historical API time boundaries and truncation guard")
