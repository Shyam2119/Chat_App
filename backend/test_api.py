import sys
import requests

url_base = 'http://localhost:5000/api'
res = requests.post(f'{url_base}/auth/register', json={
    'username': 'testuser2',
    'email': 'test2@example.com',
    'password': 'password123'
})
print('Register status:', res.status_code, res.text)
if res.status_code == 201:
    token = res.json().get('accessToken')
    res2 = requests.get(f'{url_base}/rooms/', headers={'Authorization': f'Bearer {token}'})
    print('Rooms status:', res2.status_code, res2.text)
