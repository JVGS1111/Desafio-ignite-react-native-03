import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

interface TwitchUserDataResponseProps {
  data: {
    data: User[]
  }
}
interface TwitchResponseProps {
  params: {
    access_token: string;
    state: string;
  }
  type: string
}
const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  const { CLIENT_ID } = process.env;

  async function signIn() {
    try {
      setIsLoggingIn(true);

      const REDIRECT_URI = makeRedirectUri({
        useProxy: true,
        path: `https://auth.expo.io/@jvgs1111/streamData`
      });
      const RESPONSE_TYPE = 'token';
      const SCOPE = `openid user:read:email user:read:follows`
      const FORCE_VERIFY = true;
      const STATE = generateRandom(30);
      const authUrl = encodeURI(twitchEndpoints.authorization +
        `?client_id=${CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&response_type=${RESPONSE_TYPE}` +
        `&scope=${SCOPE}` +
        `&force_verify=${FORCE_VERIFY}` +
        `&state=${STATE}`);

      const response = await startAsync({ authUrl: authUrl }) as TwitchResponseProps;

      if (response.type === 'success') {
        if (response.params.state != STATE) {
          throw new Error('Invalid state value');
        }
        api.defaults.headers.authorization = `Bearer ${response.params.access_token}`;
        const userResponse = await api.get('/users') as TwitchUserDataResponseProps;
        const formattedUser = userResponse.data.data[0];
        setUserToken(response.params.access_token);
        setUser(formattedUser);
      }

    } catch (error) {
      throw new Error('Erro ao efetuar login')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true);
      revokeAsync({ token: userToken, clientId: CLIENT_ID }, { revocationEndpoint: twitchEndpoints.revocation })
    } catch (error) {
    } finally {
      setUser({} as User);
      setUserToken('');
      delete api.defaults.headers.authorization;
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    api.defaults.headers['Client-Id'] = CLIENT_ID;

  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
