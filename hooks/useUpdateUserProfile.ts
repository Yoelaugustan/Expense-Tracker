import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { UpdateUserProfileParams, UseUpdateUserProfileResult } from '@/types'

export function useUpdateUserProfile(): UseUpdateUserProfileResult {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const updateUserProfile = useCallback(
    async ({ updatedEmail, updatedUsername, updatedImageUrl }: UpdateUserProfileParams) => {
      setLoading(true)
      setError(null)

      try {
        const userId = await AsyncStorage.getItem('userId')

        if (!userId) {
          throw new Error('No userId found in storage (user not logged in)')
        }
        
        console.log('userId:', userId)

        const {
          data: authRow,
          error: authError,
        } = await supabase
          .from('authentication')
          .select('email')
          .eq('id', userId)
          .maybeSingle()

        if (authError) {
          throw authError
        }
        if (!authRow) {
          throw new Error('No matching authentication record found')
        }

        if (updatedEmail && updatedEmail.trim() !== authRow.email) {
          const { error: updateAuthError } = await supabase
            .from('authentication')
            .update({ email: updatedEmail.trim() })
            .eq('id', userId)
          if (updateAuthError) {
            console.log('Authentication table update error:', updateAuthError)
            throw updateAuthError
          }
          console.log('Email update in authentication table successful')
        } else if (updatedEmail) {
          console.log('Email not updated - same as current email')
        }
        
        const updates: { username?: string; image?: string } = {}
        if (updatedUsername !== undefined && updatedUsername.trim() !== '') {
          updates.username = updatedUsername.trim()
        }
        if (updatedImageUrl) {
          const imageUri =
            typeof updatedImageUrl === 'object' && 'uri' in updatedImageUrl
              ? (updatedImageUrl as { uri: string }).uri
              : String(updatedImageUrl)

          if (imageUri.trim().length > 0) {
            updates.image = imageUri.trim()
          }
        }

        console.log('Profile updates to apply:', updates)

        if (Object.keys(updates).length > 0) {
          const { data: updatedData, error: updateProfileError } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', userId)
            .select()

          console.log('Supabase update response:', { updatedData, updateProfileError })
          
          if (updateProfileError) {
            throw updateProfileError
          }

          console.log('Profile update successful')
        }

        setError(null)
      } catch (err: any) {
        console.log('=== UPDATE PROFILE ERROR ===')
        console.log('Error details:', err)
        console.log('Error message:', err.message || err)
        
        let errorMessage = 'An unexpected error occurred'
        
        if (err.message?.includes('Email')) {
          errorMessage = err.message
        } else if (err.message?.includes('already registered') || err.message?.includes('already exists')) {
          errorMessage = 'This email is already registered to another account'
        } else if (err.message?.includes('invalid')) {
          errorMessage = 'Invalid email format'
        } else if (err.message) {
          errorMessage = err.message
        }
        
        setError(errorMessage)
        throw err

      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { updateUserProfile, loading, error }
}