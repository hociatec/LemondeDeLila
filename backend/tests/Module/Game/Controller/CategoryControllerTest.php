<?php

namespace App\Tests\Module\Game\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class CategoryControllerTest extends WebTestCase
{
    public function testGetCategories()
    {
        $client = static::createClient();
        $client->request('GET', '/api/game_categories');
        $this->assertEquals(200, $client->getResponse()->getStatusCode());
    }
}
