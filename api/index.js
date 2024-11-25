
const express = require('express');
const { GoogleAuth } = require('google-auth-library');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');

// Firebase configuration
const serviceAccount = require('../vitabear-v1-firebase-adminsdk-o1qcr-476b90b424.json');

const app = express();

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(cors());
app.use(bodyParser.json());


// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Admin doğrulama middleware
const ADMIN_EMAIL = "vitabearadmin@gmail.com"; 
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1]; // "Bearer <token>" şeklinde olacak
  
    if (!token) {
      return res.status(401).json({ error: 'Token is required' });
    }
  
    try {
      // Firebase Admin ile token doğrulama
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken; // Kullanıcı bilgilerini ekle
      next(); // Doğrulama başarılıysa bir sonraki middleware'e geç
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
const verifyAdmin = async (req, res, next) => {
    
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token is required' });
    }

    try {
        // Token'ı doğrula
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userEmail = decodedToken.email;

        // E-posta kontrolü (sadece admin e-posta adresiyle giriş yapılabilir)
        if (userEmail !== ADMIN_EMAIL) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Middleware kullanımı




app.get('/api/users', async (req, res) => {
    try {
      

      const userList = [];
      const listUsersResult = await admin.auth().listUsers(1000); // En fazla 1000 kullanıcı getir
      listUsersResult.users.forEach(userRecord => {
        userList.push({
          id: userRecord.uid,
          username: userRecord.displayName || 'No Name',
          email: userRecord.email,
        });
      });
      res.json({ users: userList });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).send('Error fetching users');
    }
  });
  
  // Yeni Kullanıcı Ekleme API'si
  app.post('/api/users', async (req, res) => {
    const { email, password, username } = req.body;
    
    try {
      const userRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: username,
      });
      res.status(201).json({
        message: 'User created successfully',
        user: userRecord,
      });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).send('Error creating user');
    }
  });



app.get('/api/products', async (req, res) => {
    try {
        const productsRef = admin.firestore().collection('products');
        const snapshot = await productsRef.get();
        
        if (snapshot.empty) {
            return res.status(404).json({ message: 'No products found' });
        }

        const products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });

        res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/api/products', async (req, res) => {
    try {
        const { name, price } = req.body; // Expecting { name: 'Product Name', price: 100 }
        
        // Input validation
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required.' });
        }

        // Create a new product document
        const newProductRef = await admin.firestore().collection('products').add({
            name,
            price,
        });

        res.status(201).json({ id: newProductRef.id, name, price });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price } = req.body;

        // Input validation
        if (!name && price === undefined) {
            return res.status(400).json({ error: 'At least one field (name or price) is required to update.' });
        }

        // Reference to the product document
        const productRef = admin.firestore().collection('products').doc(id);

        // Update the product
        await productRef.update({
            ...(name && { name }),  // Only update if name is provided
            ...(price !== undefined && { price }),  // Only update if price is provided
        });

        res.status(200).json({ id, name, price });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.get('/api/users', async (req, res) => {
    const userList = [];
    const listUsersResult = await admin.auth().listUsers(1000);
    listUsersResult.users.forEach(userRecord => {
      userList.push({
        id: userRecord.uid,
        username: userRecord.displayName || 'No Name',
      });
    });
    res.json({ users: userList });
});app.get('/api/Siparisler/:userId?/siparisler', async (req, res) => {
    const { userId } = req.params; // URL parametresinden userId'yi alıyoruz

    try {
        let snapshot;

        if (userId) {
            // Kullanıcı ID'si verilmişse, sadece o kullanıcıya ait siparişleri al
            snapshot = await admin.firestore()
                .collection('Siparisler')
                .doc(userId) // Dinamik olarak userId'yi alıyoruz
                .collection('siparisler') // ve alt koleksiyon olan 'siparisler'ı alıyoruz
                .get();
        } else {
            // Kullanıcı ID'si verilmemişse, tüm kullanıcıların siparişlerini al
            snapshot = await admin.firestore()
                .collectionGroup('siparisler') // Tüm 'siparisler' alt koleksiyonları üzerinde sorgu yapıyoruz
                .get();
        }

        if (snapshot.empty) {
            return res.status(404).json({ message: 'No orders found' });
        }

        // Verileri map ederek JSON formatında göndermek
        const siparisler = snapshot.docs.map(doc => {
            const data = doc.data();

            return {
                id: doc.id,
                vade: data.vade,
                toplamadet: data.toplamadet,
                toplam: data.toplam,
                status: data.status,
                timestamp: data.timestamp, // Ham timestamp verisini gönderiyoruz
                Kimden: data.kimden,
                iskonto: data.iskonto,
                uzmanprim: data.uzmanprim, 
                notlar: data.notlar,
                satışürünler: data.satışürünler,
                malfazlası: data.malfazlası,
                iskontotutar: data.iskontotutar,
                nettoplam: data.nettoplam,

                hediyeürünler: data.hediyeürünler,
                kdv: data.kdv,
            };
        });

        res.json(siparisler); // JSON formatında yanıt gönderiyoruz

    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Error fetching orders' });
    }
});

// API endpoint: Sipariş durumu güncellemek için (örneğin 'completed' olarak güncelleme)
app.put('/api/siparisler/:userId/siparisler/:orderId/status', async (req, res) => {
    const { userId, orderId } = req.params;
    const { status } = req.body; // 'status' değerini request body'den alıyoruz
    
    try {
        // Firestore'daki siparişi bulup durumunu güncelliyoruz
        const siparisRef = admin.firestore()
            .collection('Siparisler')
            .doc(userId) // Kullanıcıyı belirliyoruz
            .collection('siparisler')
            .doc(orderId); // Belirli bir siparişi buluyoruz
        
        const siparisDoc = await siparisRef.get();

        if (!siparisDoc.exists) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Durum güncellemesini yapıyoruz
        await siparisRef.update({
            status: status
        });

        res.status(200).json({ message: 'Status updated successfully' });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Error updating order status' });
    }
});



app.put('/api/siparisler/:userId/siparisler/:pharmacyId/status', async (req, res) => {
    const { userId, pharmacyId } = req.params;
    const { status } = req.body;

    try {
        // Reference to the pharmacy document
        const pharmacyRef = admin.firestore()
            .collection('Siparisler')
            .doc(userId)
            .collection('siparisler')
            .doc(pharmacyId);
        
        // Check if the document exists
        const doc = await pharmacyRef.get();
        if (!doc.exists) {
            return res.status(404).send('Pharmacy not found');
        }

        // Update the status
        await pharmacyRef.update({ status });

        res.json({ id: pharmacyId, status });
    } catch (error) {
        console.error('Error updating pharmacy status:', error);
        res.status(500).send('Internal Server Error');
    }
});app.get('/api/siparisler/:userId/siparisler/:pharmacyId/status', async (req, res) => {
    const { userId, pharmacyId } = req.params;

    try {
        // Reference to the specific pharmacy document
        const pharmacyRef = admin.firestore()
            .collection('Siparisler')
            .doc(userId)
            .collection('siparisler')
            .doc(pharmacyId);
        
        const doc = await pharmacyRef.get();
        
        if (!doc.exists) {
            return res.status(404).send('Pharmacy not found');
        }

        const status = doc.data().status; // Get the status field
        res.json({ id: pharmacyId, status: status.stringValue }); // Adjust based on your Firestore structure
    } catch (error) {
        console.error('Error fetching pharmacy status:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.post('/api/login', async (req, res) => {
    const { token } = req.body;  // Frontend'den gelen token'ı al

    try {
        // Token'ı doğrula
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Token doğrulandıysa ve adminse işlemi onayla
        const userEmail = decodedToken.email;

        // E-posta kontrolü (admin olarak kontrol et)
        if (userEmail !== 'vitabearadmin@gmail.com') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = (req, res) => {
    app(req, res); // Express.js ile gelen isteği burada işliyoruz
  };
