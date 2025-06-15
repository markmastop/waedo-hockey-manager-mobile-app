import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { LogIn, Eye, EyeOff, CircleAlert as AlertCircle } from 'lucide-react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      console.log('User already logged in, redirecting to tabs');
      router.replace('/(tabs)');
    }
  }, [user]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError('Vul alle velden in');
      return;
    }

    // Clear previous error
    setError(null);
    setLoading(true);
    
    try {
      console.log('Attempting to sign in...');
      await signIn(email, password);
      console.log('Sign in successful, redirecting to tabs');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      // Handle specific error types
      if (error.message?.includes('Invalid login credentials') || 
          error.message?.includes('invalid_credentials')) {
        setError('Onjuiste inloggegevens. Controleer je e-mailadres en wachtwoord.');
      } else if (error.message?.includes('Email not confirmed')) {
        setError('Je e-mailadres is nog niet bevestigd. Controleer je inbox.');
      } else if (error.message?.includes('Too many requests')) {
        setError('Te veel inlogpogingen. Probeer het over een paar minuten opnieuw.');
      } else {
        setError(error.message || 'Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/images/we-dohockey-orange-black-trans.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Companion</Text>
              <Text style={styles.subtitle}>De complete coaching app voor hockey teams</Text>
            </View>

            {/* Login Form */}
            <View style={styles.form}>
              {/* Error Message */}
              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>E-mailadres</Text>
                <TextInput
                  style={[styles.input, error && styles.inputError]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError(null); // Clear error when user starts typing
                  }}
                  placeholder="Voer je e-mailadres in"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Wachtwoord</Text>
                <View style={[styles.passwordContainer, error && styles.inputError]}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (error) setError(null); // Clear error when user starts typing
                    }}
                    placeholder="Voer je wachtwoord in"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#9CA3AF" />
                    ) : (
                      <Eye size={18} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
              >
                <LogIn size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>
                  {loading ? 'Inloggen...' : 'Inloggen'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Wachtwoord vergeten?</Text>
              </TouchableOpacity>
            </View>

            {/* Features Section */}
              <View style={styles.featuresSection}>
                <Text style={styles.featuresTitle}>Wat je krijgt met doHockey:</Text>
                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet} />
                    <Text style={styles.featureText}>Compleet team management</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet} />
                    <Text style={styles.featureText}>Slimme formatie builder</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet} />
                    <Text style={styles.featureText}>Live wedstrijd coaching tools</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet} />
                    <Text style={styles.featureText}>Speler prestatie tracking</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <View style={styles.featureBullet} />
                    <Text style={styles.featureText}>Geautomatiseerde wissel planning</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.versionText}>v{Constants.expoConfig?.version}</Text>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  content: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  logo: {
    width: 160,
    height: 60,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  form: {
    gap: 20,
    marginBottom: 32,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Inter-Regular',
  },
  inputError: {
    borderColor: '#FECACA',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    fontFamily: 'Inter-Regular',
  },
  eyeButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 6,
    gap: 6,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  forgotPassword: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 12,
    color: '#FF6B35',
    fontFamily: 'Inter-SemiBold',
  },
  helpSection: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  helpTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 6,
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  featuresSection: {
    alignItems: 'center',
  },
  featuresTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  featuresList: {
    alignItems: 'flex-start',
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FF6B35',
  },
  featureText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
  },
  versionText: {
    marginTop: 24,
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
});
