const apiUrl = 'https://ieyasu.co/api/v1/authentication/token';
const clientId = 'YOUR_CLIENT_ID';  // HRMOSのクライアントID
const clientSecret = 'YOUR_CLIENT_SECRET';  // HRMOSのクライアントシークレット

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
  }),
})
  .then(response => response.json())
  .then(data => {
    if (data.access_token) {
      console.log('取得したAPIトークン:', data.access_token);
      // APIトークンを使って他のエンドポイントにアクセスする
    } else {
      console.error('トークン取得エラー:', data);
    }
  })
  .catch(error => {
    console.error('リクエストエラー:', error);
  });
