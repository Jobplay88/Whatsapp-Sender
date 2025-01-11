<?php

namespace App\Http\Controllers;

use App\Traits\ApiResponser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ApiController extends Controller
{
    use ApiResponser;
    
    public static function begin(){
        DB::beginTransaction();
    }

    public static function rollback(){
        DB::rollback();
    }

    public static function commit(){
        DB::commit();
    }

    public static function is_empty($result){
        if(!isset($result) || empty($result) || is_null($result)){
            return true;
        }
        return false;
    }

    public static function current_user(){
        return Auth::user()->id ?? 0;
    }

    public static function pagination_limit() {
        return 20;
    }
}
