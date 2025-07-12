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
        const authCollection = database.collection('auth');

        // User Start
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

        // Auth start
        // POST /api/v1/auth/login
        app.post('/api/v1/auth/login', async (req, res) => {
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

            try {
                const user = await authCollection.findOne({ email });
                if (!user) return res.status(401).json({ message: 'Invalid credentials' });

                const passwordMatch = await bcrypt.compare(password, user.password);
                if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials' });

                const token = jwt.sign(
                    { id: user._id.toString(), email: user.email, role: user.role || 'USER' },
                    process.env.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                res.json({ token });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Login failed' });
            }
        });

        // GET /api/v1/auth/profile
        app.get('/api/v1/auth/profile', authMiddleware, async (req, res) => {
            try {
                const user = await authCollection.findOne(
                    { _id: new ObjectId(req.user.id) },
                    { projection: { password: 0 } }
                );
                if (!user) return res.status(404).json({ message: 'User not found' });

                res.json(user);
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Failed to get profile' });
            }
        });

        // PUT /api/v1/auth/change-password
        app.put('/api/v1/auth/change-password', authMiddleware, async (req, res) => {
            const { oldPassword, newPassword } = req.body;
            if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Old and new password required' });

            try {
                const user = await authCollection.findOne({ _id: new ObjectId(req.user.id) });
                if (!user) return res.status(404).json({ message: 'User not found' });

                const passwordMatch = await bcrypt.compare(oldPassword, user.password);
                if (!passwordMatch) return res.status(401).json({ message: 'Old password incorrect' });

                const hashedNewPassword = await bcrypt.hash(newPassword, 10);

                await authCollection.updateOne(
                    { _id: new ObjectId(req.user.id) },
                    { $set: { password: hashedNewPassword } }
                );

                res.json({ message: 'Password changed successfully' });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Failed to change password' });
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

