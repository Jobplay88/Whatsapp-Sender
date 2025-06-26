<?php

namespace App\Http\Controllers;

use App\Models\User;
use Laravel\Passport\Token;
use Illuminate\Http\Request;
use Laravel\Passport\RefreshToken;
use Illuminate\Support\Facades\Hash;
use Illuminate\Auth\Events\Registered;
use App\Http\Controllers\ApiController;
use Illuminate\Support\Facades\Validator;

class AuthController extends ApiController
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
    		return $this->response('validationError', ['errors' => $validator->errors()]);
        }

        try {
            $this->begin();

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
            ]);

            // Send email verification notification
            event(new Registered($user));

            $this->commit();

        } catch (\Throwable $th) {
            //throw $th;
            return $this->response('serverError', '', $th->getMessage());
        }

        return $this->response('success', '', 'User registered successfully.');
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'exists:users'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        if ($validator->fails()) {
    		return $this->response('validationError', ['errors' => $validator->errors()]);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
    		return $this->response('unauthorized', '', 'Invalid credentials');
        }

        // Revoke existing tokens
        Token::where('user_id', $user->id)->delete();

        // Generate new token
        $token = $user->createToken('authToken')->accessToken;

        return $this->response('success', [
            'token' => $token,
            'user' => $user
        ]);
    }

    public function logout(Request $request)
	{
        // Get the current logged user token
		$token = $request->user()->token();

		// Revoke the user access token now
		$token->revoke();

		// Revoke the refresh tokens if the user have renew their token before
		RefreshToken::where('access_token_id', $token->id)->update(['revoked' => true]);

    	return $this->response('success', '', 'Successfully logged out.');
	}
}
