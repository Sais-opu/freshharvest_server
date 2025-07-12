const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({}));
app.use(express.json());






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ih9r7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const database = client.db('freshharvest');
        const userCollection = database.collection('users');

        // User
        app.get('/api/v1/users', async (req, res) => {
            try {
                const { email, fullName, searchTerm } = req.query;
                const query = {};

                if (email) query.email = email;
                if (fullName) query.fullName = fullName;
                if (searchTerm) {
                    query.$or = [
                        { fullName: { $regex: searchTerm, $options: 'i' } },
                        { email: { $regex: searchTerm, $options: 'i' } }
                    ];
                }

                const users = await userCollection.find(query).toArray();
                res.json(users);
            } catch (error) {
                res.status(500).json({ message: "Error fetching users", error });
            }
        });

        app.post('/api/v1/users/register', async (req, res) => {
            try {
                const { fullName, email, password } = req.body;

                // Basic validation
                if (!fullName || !email || !password) {
                    return res.status(400).json({ success: false, message: 'Missing required fields' });
                }

                // Optional: check if user already exists
                const existingUser = await userCollection.findOne({ email });
                if (existingUser) {
                    return res.status(409).json({ success: false, message: 'User already exists with this email' });
                }

                // Insert new user document
                const result = await userCollection.insertOne({ fullName, email, password });

                res.status(201).json({ success: true, message: 'User registered', userId: result.insertedId });
            } catch (error) {
                console.error('Error registering user:', error);
                res.status(500).json({ success: false, message: 'Failed to register user' });
            }
        });

        app.put('/api/v1/users/profile', async (req, res) => {
            try {
                const userId = req.userId; 
                if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

                const updateData = req.body;

                // Optional: Validate updateData fields here

                const result = await userCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: updateData }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }

                res.json({ success: true, message: 'Profile updated' });
            } catch (error) {
                console.error('Error updating profile:', error);
                res.status(500).json({ success: false, message: 'Failed to update profile' });
            }
        });

        app.put('/api/v1/users/:id', async (req, res) => {
            try {
                const userId = req.params.id;
                const updateData = req.body;

                // Optional: Validate updateData fields here

                const result = await userCollection.updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: updateData }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }

                res.json({ success: true, message: 'User updated' });
            } catch (error) {
                console.error('Error updating user:', error);
                res.status(500).json({ success: false, message: 'Failed to update user' });
            }
        });


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from the server!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

