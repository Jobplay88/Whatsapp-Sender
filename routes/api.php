<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PhoneSessionController;
use Laravel\Passport\Http\Controllers\AccessTokenController;
use Laravel\Passport\Http\Controllers\TransientTokenController;
use Laravel\Passport\Http\Controllers\AuthorizedAccessTokenController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
//     return $request->user();
// });
Route::post('/oauth/token', [AccessTokenController::class, 'issueToken'])->name('passport.token');
Route::post('/oauth/token/refresh', [TransientTokenController::class, 'refreshToken'])->name('passport.refresh');
Route::delete('/oauth/token/revoke', [AuthorizedAccessTokenController::class, 'destroy'])->name('passport.revoke');

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware(['auth:api'])->group(function () {
    Route::group(['prefix' => 'phone-sessions'], function () {
        Route::get('/list', [PhoneSessionController::class, 'showPhoneSessionList']);
        Route::post('/create', [PhoneSessionController::class, 'handleAddNewPhoneSession']);
        Route::post('/delete', [PhoneSessionController::class, 'handleDeletePhoneSession']);
    });
});
