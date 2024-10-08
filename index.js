const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;



//  middleWere
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://assignments-submission.web.app",
      "https://assignments-submission.firebaseapp.com/",
    ],
    credentials: true,
  })
);
app.use(express.json())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ma7e2wv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = "mongodb+srv://shop-stream:v20kYXkM5SLtOL75@cluster0.ma7e2wv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifiedToken = async (req, res, next) => {
  const token = req.cookies.token;
  console.log('value of token from middle were', token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err => {
      return res.status(401).send({ message: 'unauthorized access' })
    })
      console.log('from decoded', decoded)
    req.user = decoded
    next()
  })

}

async function run() {
  try {
    const userCollection = client.db('shopStream').collection('user')
    const productCollection = client.db('shopStream').collection('products')


    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })


    // user collection 
    app.post('/user', async (req, res) => {
      const user = req.body
      console.log(user)
      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.get("/products", async (req, res) => {
      try {
        const { 
            search = '', 
            category, 
            brandName, 
            minPrice, 
            maxPrice, 
            sort = 'creationDateTime', 
            order = 'desc', 
            page = 1, 
            limit = 10 
        } = req.query;

        const query = {
            ...(search && { productName: { $regex: search, $options: 'i' } }),
            ...(category && { category }),
            ...(brandName && { brandName }),
            ...(minPrice && maxPrice && { price: { $gte: parseFloat(minPrice), $lte: parseFloat(maxPrice) } }),
        };

        const sortBy = { [sort]: order === 'asc' ? 1 : -1 };
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        const products = await productCollection.find(query)
            .sort(sortBy)
            .skip(skip)
            .limit(limitNum)
            .toArray();

        const totalProducts = await productCollection.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limitNum);

        res.json({
            products,
            totalProducts,
            totalPages,
            currentPage: parseInt(page),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
    })

    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('shop-stream server  running')
})
app.listen(port, () => {
  console.log(`shop-stream server is running ON port: ${port}`)
})