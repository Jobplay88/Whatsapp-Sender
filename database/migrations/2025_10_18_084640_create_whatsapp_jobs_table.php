<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('whatsapp_jobs', function (Blueprint $table) {
            $table->id();
            $table->text('file_path');
            $table->integer('total_number');
            $table->enum('status', ['pending', 'running', 'completed', 'failed'])->default('pending');
            $table->integer('progress')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('whatsapp_jobs');
    }
};
