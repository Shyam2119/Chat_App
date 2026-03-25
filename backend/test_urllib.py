import urllib.request
import json
import ssl

def main():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    url_reg = 'http://localhost:5000/api/auth/register'
    data = json.dumps({'username': 'urllibuser', 'email': 'urllib@test.com', 'password': 'password123'}).encode()
    req = urllib.request.Request(url_reg, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, context=ctx) as response:
            res_data = json.loads(response.read().decode())
            token = res_data.get('accessToken')
            print("Got token:", token[:10] + "...")
    except urllib.error.HTTPError as e:
        print("Registration failed:", e.code, e.read().decode())
        return

    url_rooms = 'http://localhost:5000/api/rooms/'
    req2 = urllib.request.Request(url_rooms, headers={'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(req2, context=ctx) as response2:
            print("Rooms success:", response2.read().decode())
    except urllib.error.HTTPError as e:
        print("Rooms GET failed:", e.code, e.read().decode())

if __name__ == '__main__':
    main()
