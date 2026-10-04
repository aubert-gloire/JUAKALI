import mongoose from 'mongoose';
import { config } from './config';

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConnection: mongoose.Connection | undefined;
  // eslint-disable-next-line no-var
  var __mongooseConnectionPromise: Promise<mongoose.Connection> | undefined;
}

export async function connectDB(): Promise<mongoose.Connection> {
  if (global.__mongooseConnection?.readyState === 1) {
    return global.__mongooseConnection;
  }

  if (global.__mongooseConnectionPromise) {
    return global.__mongooseConnectionPromise;
  }

  global.__mongooseConnectionPromise = mongoose
    .connect(config.MONGODB_URI, {
      bufferCommands: false,
    })
    .then((m) => {
      global.__mongooseConnection = m.connection;
      global.__mongooseConnectionPromise = undefined;
      return m.connection;
    })
    .catch((err) => {
      global.__mongooseConnectionPromise = undefined;
      throw err;
    });

  return global.__mongooseConnectionPromise;
}

export async function disconnectDB(): Promise<void> {
  if (global.__mongooseConnection) {
    await mongoose.disconnect();
    global.__mongooseConnection = undefined;
  }
}
